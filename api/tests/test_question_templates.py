"""Question templates and period resolution (SPEC §6, §8). One test per template.
The picker and the service (Eric) are tested in test_questions.py."""
import datetime as dt

import pytest

from dbhelpers import add_employee_advance, add_receipt, conn  # noqa: F401  (conn is a fixture)
from questions.templates import SUPPORTED, run
from questions.templates.periods import describe, resolve_period

TODAY = dt.date(2026, 5, 20)


# ---------- period resolution ----------

@pytest.mark.parametrize("period, expected", [
    ("THIS_MONTH", ("2026-05-01", "2026-05-31")),
    ("LAST_MONTH", ("2026-04-01", "2026-04-30")),
    ("THIS_QUARTER", ("2026-04-01", "2026-06-30")),
    ("MONTH:2026-02", ("2026-02-01", "2026-02-28")),
    ("MONTH:2028-02", ("2028-02-01", "2028-02-29")),
    ("RANGE:2026-04-03..2026-04-10", ("2026-04-03", "2026-04-10")),
    ("LAST_QUARTER", ("2026-01-01", "2026-03-31")),
    ("THIS_YEAR", ("2026-01-01", "2026-12-31")),
    ("MONTH:04", ("2026-04-01", "2026-04-30")),  # this year: April is before May 20
    ("MONTH:11", ("2025-11-01", "2025-11-30")),  # last year: November hasn't come yet
    ("this_month", ("2026-05-01", "2026-05-31")),
])
def test_resolve_period(period, expected):
    a, b = resolve_period(period, TODAY)
    assert (a.isoformat(), b.isoformat()) == expected


def test_resolve_period_across_year_boundaries():
    assert resolve_period("LAST_MONTH", dt.date(2026, 1, 15)) == (dt.date(2025, 12, 1), dt.date(2025, 12, 31))
    assert resolve_period("THIS_QUARTER", dt.date(2026, 12, 31)) == (dt.date(2026, 10, 1), dt.date(2026, 12, 31))
    assert resolve_period("LAST_QUARTER", dt.date(2026, 2, 1)) == (dt.date(2025, 10, 1), dt.date(2025, 12, 31))
    # "Abril" asked in February 2027 is April 2026; asked in April 2027 it is April 2027.
    assert resolve_period("MONTH:04", dt.date(2027, 2, 1)) == (dt.date(2026, 4, 1), dt.date(2026, 4, 30))
    assert resolve_period("MONTH:04", dt.date(2027, 4, 1)) == (dt.date(2027, 4, 1), dt.date(2027, 4, 30))


@pytest.mark.parametrize("period", [None, ""])
def test_no_period_is_all_time(period):
    assert resolve_period(period, TODAY) is None


@pytest.mark.parametrize("period", ["NEXT_YEAR", "MONTH:2026-13", "MONTH:13", "RANGE:2026-04-10..2026-04-01", "MONTH:26-04"])
def test_bad_period_raises(period):
    with pytest.raises(ValueError):
        resolve_period(period, TODAY)


def test_describe():
    assert describe(resolve_period("MONTH:2026-04", TODAY)) == "in April 2026"
    assert describe(resolve_period("THIS_QUARTER", TODAY)) == "in Q2 2026"
    assert describe(resolve_period("RANGE:2026-04-03..2026-04-10", TODAY)) == "from 2026-04-03 to 2026-04-10"
    assert describe(resolve_period("THIS_YEAR", TODAY)) == "in 2026"
    assert describe(None) == ""


# ---------- the templates ----------

def test_unsupported_question():
    a = run(None, None, {}, TODAY)
    assert a["kind"] == "unsupported" and a["supported"] == list(SUPPORTED.values())
    assert run(None, 99, {}, TODAY)["kind"] == "unsupported"


def test_bad_period_asks_which_period(conn):
    a = run(conn, 2, {"period": "SOMETIME"}, TODAY)
    assert a["kind"] == "clarify"
    assert [c["label"] for c in a["choices"]] == ["This month", "Last month", "This quarter"]


def test_templates_are_read_only(conn):
    run(conn, 7, {}, TODAY)
    conn.execute("INSERT INTO employee (name) VALUES ('Still writable')")  # query_only was switched back off


def test_q1_open_advances_older_than_n_days(conn):
    liq_maria = add_employee_advance(conn, "Maria Santos", 5000, "2026-05-10")
    add_receipt(conn, 1, "ACCEPTED", total=1000, date="2026-04-02")

    a = run(conn, 1, {"days": 30}, TODAY)  # Juan's (51 days) is older than 30; Maria's (10 days) isn't
    assert a["kind"] == "answer"
    assert a["table"]["rows"] == [["Juan Dela Cruz", "Field sales trip, South Luzon", "2026-03-30", 51, "OPEN", 15000.0, 14000.0]]
    assert a["sentence"] == "1 Cash Advance released more than 30 days ago is not yet liquidated, worth ₱15,000.00 in all."
    assert a["links"] == [{"label": "Juan Dela Cruz: Field sales trip, South Luzon", "href": "/liquidations/1"}]

    assert len(run(conn, 1, {"days": 5}, TODAY)["table"]["rows"]) == 2
    conn.execute("UPDATE liquidation SET status = 'APPROVED' WHERE id IN (1, ?)", (liq_maria,))
    assert run(conn, 1, {"days": None}, TODAY)["sentence"] == "No Cash Advance released more than 30 days ago is still open."


def test_q2_input_vat_lost_and_why(conn):
    add_receipt(conn, 1, "REJECT", [("DOC_TYPE", "official_receipt", "REJECT"), ("BUYER_DETAILS", "blank", "REJECT")],
                total=560, vat_amount=60, date="2026-04-03", seller_name="Cebu Hotel")
    add_receipt(conn, 1, "REJECT", [("BUYER_DETAILS", "blank", "REJECT")], total=355, vat_amount=38.04, date="2026-04-05")
    add_receipt(conn, 1, "NO_INPUT_VAT", [("VAT_ARITHMETIC", "no_breakdown", "NO_INPUT_VAT", "CONFIRMED")],
                total=200, vat_amount=None, date="2026-04-06")
    add_receipt(conn, 1, "NO_INPUT_VAT", [("DOC_TYPE", "not_valid_notice", "NO_INPUT_VAT")],
                total=112, vat_amount=12, date="2026-04-07")
    add_receipt(conn, 1, "NEEDS_REVIEW", [("SELLER_TIN", "missing", "NEEDS_REVIEW")], total=224, vat_amount=24, date="2026-04-08")
    add_receipt(conn, 1, "ACCEPTED", total=1120, vat_amount=120, date="2026-04-09")
    add_receipt(conn, 1, "REJECT", [("DATE", "outside_period", "REJECT")], total=999, vat_amount=99, date="2026-05-03")
    # A Reviewer correction moves this one into April and changes its VAT.
    add_receipt(conn, 1, "REJECT", [("DUPLICATE", "duplicate", "REJECT")], total=112, vat_amount=50, date="2026-03-31",
                corrections={"date": "2026-04-10", "vat_amount": 1200})
    # A dismissed Finding doesn't count as the reason.
    add_receipt(conn, 1, "NO_INPUT_VAT", [("BUYER_DETAILS", "blank", "REJECT", "DISMISSED"),
                                          ("DOC_TYPE", "non_vat", "NO_INPUT_VAT")], total=50, date="2026-04-11")

    a = run(conn, 2, {"period": "MONTH:2026-04"}, TODAY)
    assert a["sentence"] == ("You lost ₱122.04 of input VAT in April 2026: ₱110.04 from rejected receipts, ₱12.00 non-creditable."
                             " Another ₱24.00 is on receipts still waiting for review.")
    assert a["table"] == {"columns": ["Reason", "Receipts", "VAT"], "rows": [
        ["Official Receipt, not an Invoice", 1, 60.0],
        ["No Company name/TIN", 1, 38.04],
        ['"Not valid for input tax" printed', 1, 12.0],
        ["Submitted twice", 1, 12.0],
        ["No VAT breakdown", 1, 0.0],
        ["Non-VAT seller", 1, 0.0],
    ]}
    assert a["how"] == {"question_id": 2, "question": SUPPORTED[2], "period": {"from": "2026-04-01", "to": "2026-04-30"}}
    assert a["links"][0] == {"label": "Cebu Hotel", "href": "/receipts/1"}

    assert run(conn, 2, {"period": "MONTH:2026-06"}, TODAY)["sentence"] == "You lost no input VAT in June 2026."
    assert run(conn, 2, {}, TODAY)["how"]["period"] is None


def test_q3_amount_to_return_per_employee(conn):
    add_receipt(conn, 1, "ACCEPTED", total=12000, date="2026-04-02")
    add_receipt(conn, 1, "REJECT", total=500, date="2026-04-03")
    liq = add_employee_advance(conn, "Maria Santos", 3000, "2026-05-01")
    add_receipt(conn, liq, "NEEDS_REVIEW", total=3500, date="2026-05-02")  # Excess Spend, nothing to return
    add_employee_advance(conn, "Maria Reyes", 1000, "2026-05-01")

    a = run(conn, 3, {}, TODAY)
    assert a["sentence"] == "2 Employees have ₱4,000.00 to return in all."
    assert a["table"]["rows"] == [
        ["Juan Dela Cruz", "Field sales trip, South Luzon", "OPEN", 15000.0, 12000.0, 3000.0],
        ["Maria Reyes", "Trip", "OPEN", 1000.0, 0.0, 1000.0],
    ]

    juan, santos = (conn.execute("SELECT id FROM employee WHERE name = ?", (n,)).fetchone()[0]
                    for n in ("Juan Dela Cruz", "Maria Santos"))
    one = run(conn, 3, {"employee_id": juan, "employee_name": "Juan Dela Cruz"}, TODAY)
    assert one["sentence"] == "Juan Dela Cruz needs to return ₱3,000.00."
    assert len(one["table"]["rows"]) == 1
    assert run(conn, 3, {"employee_id": santos}, TODAY)["sentence"] == "Maria Santos has nothing to return."


def test_q4_spend_by_expense_category(conn):
    add_receipt(conn, 1, "ACCEPTED", total=355, expense_category="MEALS", date="2026-04-03")
    add_receipt(conn, 1, "NO_INPUT_VAT", total=145, expense_category="MEALS", date="2026-04-04")
    add_receipt(conn, 1, "NEEDS_REVIEW", total=2000, expense_category="TRANSPORT_FUEL", date="2026-04-05")
    add_receipt(conn, 1, "REJECT", total=5000, expense_category="LODGING", date="2026-04-06")  # not Valid Spend
    add_receipt(conn, 1, "ACCEPTED", total=100, expense_category="MEALS", date="2026-05-01")  # other month
    add_receipt(conn, 1, "ACCEPTED", total=80, expense_category="MEALS", date="2026-04-20",
                corrections={"expense_category": "SUPPLIES"})

    a = run(conn, 4, {"period": "MONTH:2026-04"}, TODAY)
    assert a["table"]["rows"] == [["Transport and fuel", 1, 2000.0], ["Meals", 2, 500.0], ["Supplies", 1, 80.0]]
    assert a["sentence"] == "Valid Spend in April 2026 was ₱2,580.00; the largest Expense Category was transport and fuel at ₱2,000.00."

    meals = run(conn, 4, {"period": "MONTH:2026-04", "expense_category": "MEALS"}, TODAY)
    assert meals["sentence"] == "Spend on meals in April 2026 was ₱500.00 across 2 receipts."
    assert run(conn, 4, {"period": "MONTH:2026-01"}, TODAY)["sentence"] == "No valid spend in January 2026."


def test_q5_suppliers_with_most_invalid_receipts(conn):
    for _ in range(2):
        add_receipt(conn, 1, "REJECT", total=284, seller_name="7-Eleven", seller_tin="000123456", date="2026-04-02")
    add_receipt(conn, 1, "REJECT", total=1000, seller_name="Petron", seller_tin="000999888", date="2026-04-03")
    add_receipt(conn, 1, "ACCEPTED", total=500, seller_name="Petron", seller_tin="000999888", date="2026-04-03")
    add_receipt(conn, 1, "REJECT", total=40, seller_name="Sari-sari", date="2026-05-03")

    a = run(conn, 5, {}, TODAY)
    assert a["table"]["rows"] == [["7-Eleven", "000-123-456", 2, 568.0], ["Petron", "000-999-888", 1, 1000.0],
                                  ["Sari-sari", None, 1, 40.0]]
    assert a["sentence"] == "7-Eleven has the most invalid receipts: 2 receipts worth ₱568.00."
    assert a["links"][0] == {"label": "7-Eleven", "href": "/receipts/1"}
    assert len(run(conn, 5, {"period": "MONTH:2026-04"}, TODAY)["table"]["rows"]) == 2


def test_q6_receipts_submitted_twice(conn):
    liq2 = add_employee_advance(conn, "Maria Santos", 3000, "2026-04-01")
    add_receipt(conn, 1, "ACCEPTED", total=284, seller_name="7-Eleven", date="2026-04-02")
    add_receipt(conn, liq2, "REJECT", [("DUPLICATE", "duplicate", "REJECT")], total=284, seller_name="7-Eleven", date="2026-04-02")
    add_receipt(conn, liq2, "ACCEPTED", [("DUPLICATE", "duplicate", "REJECT", "DISMISSED")], total=90, date="2026-04-02")

    a = run(conn, 6, {}, TODAY)
    assert a["sentence"] == "1 receipt was submitted twice, worth ₱284.00."
    assert a["table"]["rows"] == [["7-Eleven", "2026-04-02", 284.0, "Maria Santos", f"#{liq2}", "#1"]]
    assert a["links"] == [{"label": "7-Eleven", "href": "/receipts/2"}]
    assert run(conn, 6, {"period": "LAST_MONTH"}, dt.date(2026, 6, 1))["sentence"] == "No receipt was submitted twice in May 2026."


def test_q7_what_still_needs_my_review(conn):
    add_receipt(conn, 1, "NEEDS_REVIEW", [("SELLER_TIN", "missing", "NEEDS_REVIEW"), ("DATE", "missing", "NEEDS_REVIEW")],
                seller_name="Lawson")
    add_receipt(conn, 1, "REJECT", [("VAT_ARITHMETIC", "mismatch", "REJECT", "CONFIRMED")])  # resolved
    liq2 = add_employee_advance(conn, "Maria Santos", 3000, "2026-04-01")
    add_receipt(conn, liq2, "NEEDS_REVIEW", [("DATE", "missing", "NEEDS_REVIEW")])
    conn.execute("UPDATE liquidation SET status = 'RETURNED' WHERE id = ?", (liq2,))

    a = run(conn, 7, {}, TODAY)
    assert a["sentence"] == "2 Findings on 1 receipt in 1 Liquidation need your review."
    assert a["table"]["rows"] == [["Juan Dela Cruz", "Lawson", "SELLER_TIN missing"], ["Juan Dela Cruz", "Lawson", "DATE missing"]]
    assert a["links"] == [{"label": "Lawson", "href": "/receipts/1"}]
    conn.execute("UPDATE finding SET state = 'DISMISSED'")
    assert run(conn, 7, {}, TODAY)["sentence"] == "Nothing needs your review."
