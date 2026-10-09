"""Build checked receipts straight in the DB, for tests of the read-only modules (questions, exports)."""
import json

import pytest

import db
from db.seed import create_cash_advance, seed
from money import to_centavos


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setenv("TALLY_SEED_PLACEHOLDERS", "0")
    c = db.connect(tmp_path / "q.db")
    db.init_db(c)
    seed(c)  # Juan Dela Cruz: ₱15,000 released 2026-03-30, Liquidation 1
    yield c
    c.close()


def liquidation_of(conn, cash_advance_id):
    return conn.execute("SELECT id FROM liquidation WHERE cash_advance_id = ?", (cash_advance_id,)).fetchone()[0]


def add_employee_advance(conn, name, amount, released_on, spending_end_on="2026-06-30", purpose="Trip"):
    row = conn.execute("SELECT id FROM employee WHERE name = ?", (name,)).fetchone()  # the seed has Maria Santos
    eid = row[0] if row else conn.execute("INSERT INTO employee (name) VALUES (?)", (name,)).lastrowid
    return liquidation_of(conn, create_cash_advance(conn, eid, to_centavos(amount), purpose, released_on, spending_end_on))


def add_receipt(conn, liquidation_id, status, findings=(), corrections=None, **derived):
    """A processed, checked receipt. Amounts in pesos; findings are (check, condition, severity[, state])."""
    for k in ("total", "vat_amount", "vatable_sales", "vat_exempt_sales", "zero_rated_sales", "withholding_tax"):
        if k in derived:
            derived[k] = to_centavos(derived[k])
    derived.setdefault("seller_name", "Seller")
    rid = conn.execute(
        "INSERT INTO receipt (liquidation_id, stage, image_path, image_hash, derived, status, checks_run) "
        "VALUES (?, 'done', 'x.jpg', ?, ?, ?, 1)",
        (liquidation_id, f"hash-{conn.execute('SELECT COUNT(*) FROM receipt').fetchone()[0]}", json.dumps(derived), status),
    ).lastrowid
    for f in findings:
        check, condition, severity, *state = f
        conn.execute('INSERT INTO finding (receipt_id, "check", condition, severity, state, message, related_liquidation_id) '
                     "VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (rid, check, condition, severity, state[0] if state else "OPEN", f"{check} {condition}",
                      (liquidation_id - 1 or None) if check == "DUPLICATE" else None))
    for field, value in (corrections or {}).items():
        conn.execute("INSERT INTO correction (receipt_id, field, value, previous) VALUES (?, ?, ?, NULL)",
                     (rid, field, json.dumps(value)))
    conn.commit()
    return rid
