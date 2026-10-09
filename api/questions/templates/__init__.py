"""Question SQL templates (SPEC §6). Owner: Simon — hours 8–11.

run() executes one fixed, read-only, parameterized query and builds the answer in code.
No number in an answer may come from the model.
"""
import datetime as dt
import sqlite3

SUPPORTED = {
    1: "Open Cash Advances older than N days",
    2: "Input VAT lost in a period, and why",
    3: "Amount to Return per Employee",
    4: "Spend by Expense Category in a period",
    5: "Suppliers with the most invalid receipts",
    6: "Receipts submitted twice",
    7: "What still needs my review",
}


def resolve_period(period: str | None, today: dt.date) -> tuple[dt.date, dt.date] | None:
    """THIS_MONTH | LAST_MONTH | THIS_QUARTER | MONTH:YYYY-MM | RANGE:a..b -> (from, to), inclusive."""
    raise NotImplementedError("Simon: hours 8–11")


def run(conn: sqlite3.Connection, question_id: int, slots: dict, today: dt.date) -> dict:
    """Return an answer dict: {kind: "answer", sentence, table, links, how}."""
    raise NotImplementedError("Simon: hours 8–11")
