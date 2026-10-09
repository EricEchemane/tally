"""Question SQL templates (SPEC §6). Owner: Simon.

run() executes fixed, read-only, parameterized queries and builds the answer in code.
No number in an answer may come from the model: slots only choose the template and its parameters.
"""
import datetime as dt
import sqlite3
from contextlib import contextmanager

import serialize
from money import to_pesos
from questions.templates.periods import describe, resolve_period

__all__ = ["SUPPORTED", "resolve_period", "run"]

SUPPORTED = {
    1: "Open Cash Advances older than N days",
    2: "Input VAT lost in a period, and why",
    3: "Amount to Return per Employee",
    4: "Spend by Expense Category in a period",
    5: "Suppliers with the most invalid receipts",
    6: "Receipts submitted twice",
    7: "What still needs my review",
}

DEFAULT_DAYS = 30
CATEGORIES = {"MEALS": "Meals", "TRANSPORT_FUEL": "Transport and fuel", "LODGING": "Lodging",
              "SUPPLIES": "Supplies", "OTHER": "Other"}

# Why a receipt's VAT was lost, keyed by its deciding Finding. Checks are tried in SPEC §5 order.
CHECK_ORDER = ["DOC_TYPE", "SELLER_TIN", "BUYER_DETAILS", "VAT_ARITHMETIC", "DUPLICATE", "DATE"]
REASONS = {
    ("DOC_TYPE", "official_receipt"): "Official Receipt, not an Invoice",
    ("DOC_TYPE", "foreign"): "Foreign document",
    ("DOC_TYPE", "no_title"): "Not an Invoice",
    ("DOC_TYPE", "non_vat"): "Non-VAT seller",
    ("DOC_TYPE", "not_valid_notice"): '"Not valid for input tax" printed',
    ("SELLER_TIN", "missing"): "Seller TIN missing",
    ("SELLER_TIN", "branch_missing"): "Seller branch code missing",
    ("BUYER_DETAILS", "tin_mismatch"): "Buyer TIN isn't the Company's",
    ("BUYER_DETAILS", "blank"): "No Company name/TIN",
    ("BUYER_DETAILS", "unreadable"): "Buyer TIN unreadable",
    ("VAT_ARITHMETIC", "mismatch"): "Amounts don't add up",
    ("VAT_ARITHMETIC", "no_breakdown"): "No VAT breakdown",
    ("VAT_ARITHMETIC", "total_missing"): "Total not found",
    ("DUPLICATE", "duplicate"): "Submitted twice",
    ("DATE", "outside_period"): "Outside the Spending Period",
    ("DATE", "missing"): "Date missing",
}


def _effective(field: str) -> str:
    """SQL for a receipt's value used: the Reviewer's correction if any, else the derived value.
    `field` is always a constant from this module, never user input."""
    corrected = f"SELECT 1 FROM correction c WHERE c.receipt_id = r.id AND c.field = '{field}'"
    value = f"SELECT json_extract(c.value, '$') FROM correction c WHERE c.receipt_id = r.id AND c.field = '{field}'"
    return f"CASE WHEN EXISTS ({corrected}) THEN ({value}) ELSE json_extract(r.derived, '$.{field}') END AS {field}"


# Every checked receipt with its effective values; amounts are centavos.
EFF = f"""
WITH eff AS (
    SELECT r.id, r.liquidation_id, r.status, l.status AS liquidation_status, e.name AS employee,
           {", ".join(_effective(f) for f in ("seller_name", "seller_tin", "date", "total", "vat_amount", "expense_category"))}
    FROM receipt r
    JOIN liquidation l ON l.id = r.liquidation_id
    JOIN cash_advance ca ON ca.id = l.cash_advance_id
    JOIN employee e ON e.id = ca.employee_id
    WHERE r.stage = 'done' AND r.checks_run = 1 AND r.status IS NOT NULL
)"""
IN_PERIOD = "(:d_from IS NULL OR eff.date BETWEEN :d_from AND :d_to)"

SQL_OPEN_ADVANCES = """
SELECT l.id AS liquidation_id, l.status, e.name AS employee, ca.purpose, ca.released_on, ca.amount
FROM liquidation l
JOIN cash_advance ca ON ca.id = l.cash_advance_id
JOIN employee e ON e.id = ca.employee_id
WHERE l.status != 'APPROVED' AND ca.released_on < :cutoff
ORDER BY ca.released_on, l.id"""

SQL_VAT_LOST = EFF + f"""
SELECT eff.id, eff.seller_name, eff.status, eff.vat_amount, f."check", f.condition
FROM eff
LEFT JOIN finding f ON f.receipt_id = eff.id AND f.state IN ('OPEN', 'CONFIRMED') AND f.severity = eff.status
WHERE eff.status IN ('REJECT', 'NO_INPUT_VAT', 'NEEDS_REVIEW') AND {IN_PERIOD}
ORDER BY eff.id"""

SQL_EMPLOYEES = "SELECT id, name FROM employee WHERE (:pattern IS NULL OR name LIKE :pattern ESCAPE '\\') ORDER BY name"

SQL_LIQUIDATIONS_OF = """
SELECT l.id AS liquidation_id, l.status, e.name AS employee, ca.purpose
FROM liquidation l
JOIN cash_advance ca ON ca.id = l.cash_advance_id
JOIN employee e ON e.id = ca.employee_id
WHERE e.id = :employee_id
ORDER BY ca.released_on, l.id"""

SQL_SPEND_BY_CATEGORY = EFF + f"""
SELECT eff.expense_category, COUNT(*) AS receipts, SUM(COALESCE(eff.total, 0)) AS spend
FROM eff
WHERE eff.status != 'REJECT' AND (:category IS NULL OR eff.expense_category = :category) AND {IN_PERIOD}
GROUP BY eff.expense_category
ORDER BY spend DESC, eff.expense_category"""

SQL_INVALID_SUPPLIERS = EFF + f"""
SELECT MAX(eff.seller_name) AS seller_name, MAX(eff.seller_tin) AS seller_tin, COUNT(*) AS receipts,
       SUM(COALESCE(eff.total, 0)) AS amount, MIN(eff.id) AS first_receipt_id
FROM eff
WHERE eff.status = 'REJECT' AND {IN_PERIOD}
GROUP BY COALESCE(eff.seller_tin, UPPER(TRIM(eff.seller_name)), 'receipt ' || eff.id)
ORDER BY receipts DESC, amount DESC
LIMIT 5"""

SQL_DUPLICATES = EFF + f"""
SELECT eff.id, eff.liquidation_id, eff.employee, eff.seller_name, eff.date, eff.total,
       f.related_liquidation_id, f.message
FROM finding f
JOIN eff ON eff.id = f.receipt_id
WHERE f."check" = 'DUPLICATE' AND f.state != 'DISMISSED' AND {IN_PERIOD}
ORDER BY eff.id"""

SQL_NEEDS_REVIEW = EFF + """
SELECT eff.id, eff.liquidation_id, eff.employee, eff.seller_name, f.message
FROM finding f
JOIN eff ON eff.id = f.receipt_id
WHERE f.state = 'OPEN' AND f.severity = 'NEEDS_REVIEW' AND eff.liquidation_status = 'OPEN'
ORDER BY eff.liquidation_id, eff.id, f.id"""


# ---------- helpers ----------

def _peso(centavos: int | None) -> str:
    return f"₱{(centavos or 0) / 100:,.2f}"


def _plural(n: int, word: str, plural: str | None = None) -> str:
    return f"{n} {word if n == 1 else plural or word + 's'}"


def _receipt_label(row) -> str:
    return row["seller_name"] or f"Receipt #{row['id']}"


def _receipt_links(rows, limit: int = 10) -> list[dict]:
    seen, links = set(), []
    for r in rows:
        if r["id"] not in seen and len(links) < limit:
            seen.add(r["id"])
            links.append({"label": _receipt_label(r), "href": f"/receipts/{r['id']}"})
    return links


def _period_params(span) -> dict:
    return {"d_from": span[0].isoformat() if span else None, "d_to": span[1].isoformat() if span else None}


def _answer(question_id: int, span, sentence: str, columns: list[str], rows: list[list], links: list[dict]) -> dict:
    return {
        "kind": "answer", "sentence": sentence, "table": {"columns": columns, "rows": rows}, "links": links,
        "how": {"question_id": question_id, "question": SUPPORTED[question_id],
                "period": {"from": span[0].isoformat(), "to": span[1].isoformat()} if span else None},
    }


def _in(span) -> str:
    return f" {describe(span)}" if span else ""


@contextmanager
def _read_only(conn: sqlite3.Connection):
    """SQLite refuses any write while the templates run."""
    conn.execute("PRAGMA query_only = ON")
    try:
        yield
    finally:
        conn.execute("PRAGMA query_only = OFF")


def unsupported() -> dict:
    return {"kind": "unsupported", "sentence": "I can't answer that yet. These are the questions I can answer:",
            "supported": list(SUPPORTED.values())}


# ---------- the 7 templates ----------

def _q1_open_advances(conn, slots, span, today):
    days = slots.get("days")
    days = DEFAULT_DAYS if days is None or int(days) < 0 else int(days)
    cutoff = today - dt.timedelta(days=days)
    rows = conn.execute(SQL_OPEN_ADVANCES, {"cutoff": cutoff.isoformat()}).fetchall()
    table = []
    for r in rows:
        totals = serialize.totals_centavos(conn, r["liquidation_id"])
        age = (today - dt.date.fromisoformat(r["released_on"])).days
        table.append([r["employee"], r["purpose"], r["released_on"], age, r["status"],
                      to_pesos(r["amount"]), to_pesos(totals["amount_to_return"])])
    if rows:
        total = sum(r["amount"] for r in rows)
        sentence = (f"{_plural(len(rows), 'Cash Advance')} released more than {_plural(days, 'day')} ago "
                    f"{'is' if len(rows) == 1 else 'are'} not yet liquidated, worth {_peso(total)} in all.")
    else:
        sentence = f"No Cash Advance released more than {_plural(days, 'day')} ago is still open."
    links = [{"label": f"{r['employee']}: {r['purpose']}", "href": f"/liquidations/{r['liquidation_id']}"} for r in rows]
    return _answer(1, None, sentence,
                   ["Employee", "Purpose", "Released", "Days open", "Status", "Advance", "Amount to Return"], table, links)


def _q2_vat_lost(conn, slots, span, today):
    rows = conn.execute(SQL_VAT_LOST, _period_params(span)).fetchall()
    # One deciding Finding per receipt, in check order, so every receipt is counted once.
    def rank(r):
        return CHECK_ORDER.index(r["check"]) if r["check"] in CHECK_ORDER else len(CHECK_ORDER)

    by_receipt: dict[int, sqlite3.Row] = {}
    for r in rows:
        if r["id"] not in by_receipt or rank(r) < rank(by_receipt[r["id"]]):
            by_receipt[r["id"]] = r

    lost = {"REJECT": 0, "NO_INPUT_VAT": 0}
    pending = 0
    reasons: dict[str, list[int]] = {}  # label -> [receipts, vat]
    lost_rows = []
    for r in by_receipt.values():
        vat = r["vat_amount"] or 0
        if r["status"] == "NEEDS_REVIEW":
            pending += vat
            continue
        lost[r["status"]] += vat
        lost_rows.append(r)
        label = REASONS.get((r["check"], r["condition"]), "Rejected" if r["status"] == "REJECT" else "Non-creditable")
        entry = reasons.setdefault(label, [0, 0])
        entry[0] += 1
        entry[1] += vat

    total = lost["REJECT"] + lost["NO_INPUT_VAT"]
    if lost_rows:
        sentence = (f"You lost {_peso(total)} of input VAT{_in(span)}: {_peso(lost['REJECT'])} from rejected receipts, "
                    f"{_peso(lost['NO_INPUT_VAT'])} non-creditable.")
    else:
        sentence = f"You lost no input VAT{_in(span)}."
    if pending:
        sentence += f" Another {_peso(pending)} is on receipts still waiting for review."
    table = [[label, n, to_pesos(vat)] for label, (n, vat) in sorted(reasons.items(), key=lambda kv: (-kv[1][1], kv[0]))]
    return _answer(2, span, sentence, ["Reason", "Receipts", "VAT"], table, _receipt_links(lost_rows))


def _q3_amount_to_return(conn, slots, span, today):
    name = (slots.get("employee") or "").strip()
    pattern = None
    if name:
        pattern = "%" + name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    employees = conn.execute(SQL_EMPLOYEES, {"pattern": pattern}).fetchall()
    if name:
        exact = [e for e in employees if e["name"].lower() == name.lower()]
        employees = exact or employees
        if len(employees) != 1:
            choices = employees or conn.execute(SQL_EMPLOYEES, {"pattern": None}).fetchall()
            sentence = (f"Which {name} do you mean?" if employees
                        else f"I couldn't find an Employee named {name}. Did you mean one of these?")
            return {"kind": "clarify", "sentence": sentence,
                    "choices": [{"label": e["name"], "text": f"How much does {e['name']} need to return?"} for e in choices]}

    table, links, owed = [], [], {}
    for e in employees:
        for r in conn.execute(SQL_LIQUIDATIONS_OF, {"employee_id": e["id"]}):
            t = serialize.totals_centavos(conn, r["liquidation_id"])
            if t["amount_to_return"] <= 0 and not name:
                continue
            owed[e["name"]] = owed.get(e["name"], 0) + t["amount_to_return"]
            table.append([e["name"], r["purpose"], r["status"], to_pesos(t["advance"]), to_pesos(t["valid_spend"]),
                          to_pesos(t["amount_to_return"])])
            links.append({"label": f"{e['name']}: {r['purpose']}", "href": f"/liquidations/{r['liquidation_id']}"})

    if name:
        who = employees[0]["name"]
        amount = owed.get(who, 0)
        sentence = f"{who} needs to return {_peso(amount)}." if amount else f"{who} has nothing to return."
    elif owed:
        sentence = (f"{_plural(len(owed), 'Employee')} {'has' if len(owed) == 1 else 'have'} "
                    f"{_peso(sum(owed.values()))} to return in all.")
    else:
        sentence = "No Employee has anything to return."
    return _answer(3, None, sentence,
                   ["Employee", "Purpose", "Status", "Advance", "Valid Spend", "Amount to Return"], table, links)


def _q4_spend_by_category(conn, slots, span, today):
    category = slots.get("expense_category")
    category = category if category in CATEGORIES else None
    rows = conn.execute(SQL_SPEND_BY_CATEGORY, {"category": category, **_period_params(span)}).fetchall()
    table = [[CATEGORIES.get(r["expense_category"], "Uncategorized"), r["receipts"], to_pesos(r["spend"])] for r in rows]
    total = sum(r["spend"] for r in rows)
    if category:
        sentence = (f"Spend on {CATEGORIES[category].lower()}{_in(span)} was {_peso(total)} "
                    f"across {_plural(sum(r['receipts'] for r in rows), 'receipt')}.")
    elif rows:
        top = table[0][0]
        sentence = f"Valid Spend{_in(span)} was {_peso(total)}; the largest Expense Category was {top.lower()} at {_peso(rows[0]['spend'])}."
    else:
        sentence = f"No valid spend{_in(span)}."
    return _answer(4, span, sentence, ["Expense Category", "Receipts", "Spend"], table, [])


def _q5_invalid_suppliers(conn, slots, span, today):
    rows = conn.execute(SQL_INVALID_SUPPLIERS, _period_params(span)).fetchall()
    table = [[r["seller_name"] or "Unknown seller", _tin(r["seller_tin"]), r["receipts"], to_pesos(r["amount"])] for r in rows]
    if rows:
        top = rows[0]
        sentence = (f"{top['seller_name'] or 'An unknown seller'} has the most invalid receipts{_in(span)}: "
                    f"{_plural(top['receipts'], 'receipt')} worth {_peso(top['amount'])}.")
    else:
        sentence = f"No supplier has an invalid receipt{_in(span)}."
    links = [{"label": r["seller_name"] or "Unknown seller", "href": f"/receipts/{r['first_receipt_id']}"} for r in rows]
    return _answer(5, span, sentence, ["Supplier", "TIN", "Invalid receipts", "Amount"], table, links)


def _q6_duplicates(conn, slots, span, today):
    rows = conn.execute(SQL_DUPLICATES, _period_params(span)).fetchall()
    table = [[_receipt_label(r), r["date"], to_pesos(r["total"]), r["employee"],
              f"#{r['liquidation_id']}", f"#{r['related_liquidation_id']}" if r["related_liquidation_id"] else None]
             for r in rows]
    if rows:
        amount = sum(r["total"] or 0 for r in rows)
        sentence = f"{_plural(len(rows), 'receipt was', 'receipts were')} submitted twice{_in(span)}, worth {_peso(amount)}."
    else:
        sentence = f"No receipt was submitted twice{_in(span)}."
    return _answer(6, span, sentence,
                   ["Receipt", "Date", "Amount", "Submitted by", "Liquidation", "First submitted in"], table,
                   _receipt_links(rows))


def _q7_needs_review(conn, slots, span, today):
    rows = conn.execute(SQL_NEEDS_REVIEW).fetchall()
    table = [[r["employee"], _receipt_label(r), r["message"]] for r in rows]
    receipts = {r["id"] for r in rows}
    liquidations = {r["liquidation_id"] for r in rows}
    if rows:
        sentence = (f"{_plural(len(rows), 'Finding')} on {_plural(len(receipts), 'receipt')} in "
                    f"{_plural(len(liquidations), 'Liquidation')} {'needs' if len(rows) == 1 else 'need'} your review.")
    else:
        sentence = "Nothing needs your review."
    return _answer(7, None, sentence, ["Employee", "Receipt", "What to check"], table, _receipt_links(rows, limit=20))


def _tin(tin: str | None) -> str | None:
    return f"{tin[:3]}-{tin[3:6]}-{tin[6:9]}" if tin and len(tin) >= 9 else tin


TEMPLATES = {1: _q1_open_advances, 2: _q2_vat_lost, 3: _q3_amount_to_return, 4: _q4_spend_by_category,
             5: _q5_invalid_suppliers, 6: _q6_duplicates, 7: _q7_needs_review}
USES_PERIOD = {2, 4, 5, 6}


def run(conn: sqlite3.Connection, question_id: int | None, slots: dict, today: dt.date) -> dict:
    """Answer one supported question. Returns {kind: "answer", sentence, table, links, how},
    {kind: "clarify", sentence, choices} or {kind: "unsupported", sentence, supported} (SPEC §6, §7)."""
    if question_id not in TEMPLATES:
        return unsupported()
    span = None
    if question_id in USES_PERIOD:
        try:
            span = resolve_period(slots.get("period"), today)
        except ValueError:
            q = SUPPORTED[question_id].replace(" in a period", "")
            return {"kind": "clarify", "sentence": "Which period do you mean?",
                    "choices": [{"label": label, "text": f"{q} {label.lower()}"}
                                for label in ("This month", "Last month", "This quarter")]}
    with _read_only(conn):
        return TEMPLATES[question_id](conn, slots, span, today)
