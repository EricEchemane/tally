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
    """THIS_MONTH | LAST_MONTH | THIS_QUARTER | LAST_QUARTER | THIS_YEAR | MONTH:MM | MONTH:YYYY-MM
    | RANGE:YYYY-MM-DD..YYYY-MM-DD -> (from, to), inclusive. None -> None (question's own default).
    MONTH:MM (no year) means the most recent such month on or before today: "Abril" asked in
    October 2026 is April 2026; asked in February 2027 it is April 2026 too."""
    raise NotImplementedError("Simon: hours 8–11")


def run(conn: sqlite3.Connection, question_id: int, slots: dict, today: dt.date) -> dict:
    """Return an answer dict: {kind: "answer", sentence, table, links, how}.

    slots (built by questions.service from the LLM's pick; never trust free text in them):
      employee_id / employee_name  int | None   question 3 only; None = every Employee
      expense_category             str | None   question 4; MEALS | TRANSPORT_FUEL | LODGING | SUPPLIES | OTHER
      period                       str | None   see resolve_period
      days                         int | None   question 1; suggest 30 when None
    how = {"question_id", "question", "period": {"from", "to"} | None}
    """
    raise NotImplementedError("Simon: hours 8–11")
