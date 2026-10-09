"""What an empty database starts with. TALLY_SEED picks it (SPEC §9):

    demo (default)   the demo data (db/demo.py)
    placeholders     demo Company + one Cash Advance + 4 hand-written receipts (API tests)
    minimal          demo Company + one Cash Advance, no receipts (pipeline tests)
"""
import os
import secrets

import db
from money import to_centavos

DEMO_COMPANY = ("Bayanihan Demo Corp", "12345678900000")


def seed(conn) -> None:
    if conn.execute("SELECT COUNT(*) FROM company").fetchone()[0]:
        return  # never touch an existing database
    mode = os.environ.get("TALLY_SEED", "demo")
    if mode == "demo":
        from db import demo
        demo.reset(conn)
        return
    conn.execute("INSERT INTO company (id, name, tin, buyer_details_rule) VALUES (1, ?, ?, 'ALL_RECEIPTS')", DEMO_COMPANY)
    juan = conn.execute("INSERT INTO employee (name) VALUES ('Juan Dela Cruz')").lastrowid
    conn.execute("INSERT INTO employee (name) VALUES ('Maria Santos')")
    ca = create_cash_advance(conn, juan, to_centavos(15000), "Field sales trip, South Luzon", "2026-03-30", "2026-05-02")
    if mode == "placeholders":
        from db import placeholders
        liq = conn.execute("SELECT id FROM liquidation WHERE cash_advance_id = ?", (ca,)).fetchone()[0]
        placeholders.insert(conn, liq)
    conn.commit()


def create_cash_advance(conn, employee_id, amount_centavos, purpose, released_on, spending_end_on) -> int:
    """A Cash Advance always gets its Liquidation (1:1)."""
    ca = conn.execute(
        "INSERT INTO cash_advance (employee_id, amount, purpose, released_on, spending_end_on) VALUES (?, ?, ?, ?, ?)",
        (employee_id, amount_centavos, purpose, released_on, spending_end_on),
    ).lastrowid
    conn.execute(
        "INSERT INTO liquidation (cash_advance_id, capture_token) VALUES (?, ?)", (ca, secrets.token_urlsafe(12))
    )
    return ca


if __name__ == "__main__":
    conn = db.connect()
    db.init_db(conn)
    seed(conn)
    print("seeded", conn.execute("SELECT COUNT(*) FROM cash_advance").fetchone()[0], "cash advance(s)")
