"""The Overview page: a period's spend, disallowed amounts, lost input VAT, outstanding advances.

Numbers come from the same effective-value SQL as the Ask Tally templates (questions/templates), so the
page and the answers always agree. Computed in code; no model is involved. Receipts are placed in a
period by their own date; a receipt with no date only counts when no period is chosen.
"""
import datetime as dt
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

import config
from db import get_db
from money import to_pesos
from questions.templates import CATEGORIES, CHECK_ORDER, EFF, IN_PERIOD, REASONS, SQL_OPEN_ADVANCES, resolve_period
from questions.templates.periods import describe

router = APIRouter(prefix="/api")

OVERDUE_DAYS = 30
PERIODS = ["THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR", "ALL"]

SQL_RECEIPTS = EFF + f"""
SELECT eff.id, eff.liquidation_id, eff.employee, eff.status, eff.total, eff.vat_amount, eff.expense_category
FROM eff WHERE {IN_PERIOD}"""

# The Finding that decided each rejected or non-creditable receipt (one per receipt, in check order).
SQL_DECIDING = EFF + f"""
SELECT eff.id, eff.status, eff.total, eff.vat_amount, f."check", f.condition
FROM eff
LEFT JOIN finding f ON f.receipt_id = eff.id AND f.state IN ('OPEN', 'CONFIRMED') AND f.severity = eff.status
WHERE eff.status IN ('REJECT', 'NO_INPUT_VAT') AND {IN_PERIOD}"""


def _rank(check: str | None) -> int:
    return CHECK_ORDER.index(check) if check in CHECK_ORDER else len(CHECK_ORDER)


def build(conn: sqlite3.Connection, period: str, today: dt.date) -> dict:
    span = None if period == "ALL" else resolve_period(period, today)
    params = {"d_from": span[0].isoformat() if span else None, "d_to": span[1].isoformat() if span else None}
    receipts = conn.execute(SQL_RECEIPTS, params).fetchall()

    spend = sum(r["total"] or 0 for r in receipts)
    disallowed = sum(r["total"] or 0 for r in receipts if r["status"] == "REJECT")
    by_category: dict[str, int] = {}
    by_employee: dict[str, list[int]] = {}  # name -> [valid, disallowed]
    for r in receipts:
        if r["status"] != "REJECT":
            key = r["expense_category"] or "OTHER"
            by_category[key] = by_category.get(key, 0) + (r["total"] or 0)
        e = by_employee.setdefault(r["employee"], [0, 0])
        e[1 if r["status"] == "REJECT" else 0] += r["total"] or 0

    deciding: dict[int, sqlite3.Row] = {}
    for r in conn.execute(SQL_DECIDING, params):
        if r["id"] not in deciding or _rank(r["check"]) < _rank(deciding[r["id"]]["check"]):
            deciding[r["id"]] = r
    reasons: dict[str, dict] = {}
    vat_lost = 0
    for r in deciding.values():
        vat_lost += r["vat_amount"] or 0
        if r["status"] != "REJECT":
            continue
        label = REASONS.get((r["check"], r["condition"]), "Rejected")
        entry = reasons.setdefault(label, {"reason": label, "receipts": 0, "amount": 0, "receipt_ids": []})
        entry["receipts"] += 1
        entry["amount"] += r["total"] or 0
        entry["receipt_ids"].append(r["id"])

    cutoff = (today - dt.timedelta(days=OVERDUE_DAYS)).isoformat()
    overdue = conn.execute(SQL_OPEN_ADVANCES, {"cutoff": cutoff}).fetchall()
    open_count, open_amount = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(ca.amount), 0) FROM liquidation l JOIN cash_advance ca ON ca.id = l.cash_advance_id "
        "WHERE l.status = 'OPEN'").fetchone()

    return {
        "period": period,
        "period_label": describe(span).removeprefix("in ") if span else "all time",
        "receipts": len(receipts),
        "needs_review": sum(r["status"] == "NEEDS_REVIEW" for r in receipts),
        "spend": to_pesos(spend),
        "valid_spend": to_pesos(spend - disallowed),
        "disallowed": to_pesos(disallowed),
        "input_vat_lost": to_pesos(vat_lost),
        "outstanding": {
            "open": open_count, "amount": to_pesos(open_amount),
            "overdue_days": OVERDUE_DAYS,
            "overdue": [{"liquidation_id": r["liquidation_id"], "employee": r["employee"], "purpose": r["purpose"],
                         "released_on": r["released_on"], "days": (today - dt.date.fromisoformat(r["released_on"])).days,
                         "amount": to_pesos(r["amount"])} for r in overdue],
        },
        "disallowed_reasons": sorted(({**v, "amount": to_pesos(v["amount"])} for v in reasons.values()),
                                     key=lambda v: (-v["amount"], v["reason"])),
        "by_category": sorted(({"category": CATEGORIES.get(k, k), "amount": to_pesos(v)} for k, v in by_category.items()),
                              key=lambda v: -v["amount"]),
        "by_employee": sorted(({"employee": k, "valid_spend": to_pesos(v[0]), "disallowed": to_pesos(v[1])}
                               for k, v in by_employee.items()), key=lambda v: -(v["valid_spend"] + v["disallowed"])),
    }


@router.get("/overview")
def overview(period: str = "THIS_MONTH", conn: sqlite3.Connection = Depends(get_db)):
    if period not in PERIODS:
        raise HTTPException(422, f"period must be one of {', '.join(PERIODS)}")
    return build(conn, period, config.today())
