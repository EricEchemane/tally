"""Checks engine (SPEC §5): every table row, a golden run of all 18 samples, and the Reviewer flows."""
import time
from pathlib import Path

import pytest

from checks.engine import Context, OtherReceipt, run_checks

SAMPLES = Path(__file__).resolve().parents[2] / "samples" / "receipts"
CTX = Context("12345678900000", "ALL_RECEIPTS", "2026-03-30", "2026-05-02")
GOOD = {  # a clean VAT invoice with the Company's buyer details, in the Spending Period
    "doc_type": "INVOICE", "currency": "PHP", "vat_registered": True, "not_valid_notice": False,
    "seller_tin": "240727673", "seller_branch": "00006", "invoice_number": "175026", "date": "2026-04-03",
    "buyer_name": "Bayanihan Demo Corp", "buyer_tin": "123456789", "buyer_tin_raw": "123-456-789-00000",
    "vatable_sales": 31696, "vat_amount": 3804, "vat_exempt_sales": 0, "zero_rated_sales": 0, "total": 35500,
}


def conditions(r=None, ctx=CTX, others=(), rid=10, image_hash="h10", **overrides):
    found = run_checks({**GOOD, **(r or {}), **overrides}, rid, image_hash, ctx, list(others))
    return {(f.check, f.condition, f.severity) for f in found}


def test_clean_invoice_has_no_findings():
    assert conditions() == set()


@pytest.mark.parametrize("overrides,expected", [
    # 1. Document type
    ({"doc_type": "OFFICIAL_RECEIPT"}, ("DOC_TYPE", "official_receipt", "REJECT")),
    ({"currency": "USD", "doc_type": "OTHER"}, ("DOC_TYPE", "foreign", "REJECT")),
    ({"doc_type": None}, ("DOC_TYPE", "no_title", "NEEDS_REVIEW")),
    ({"vat_registered": False, "vatable_sales": None, "vat_amount": None, "total": 26000}, ("DOC_TYPE", "non_vat", "NO_INPUT_VAT")),
    ({"not_valid_notice": True}, ("DOC_TYPE", "not_valid_notice", "NO_INPUT_VAT")),
    # 2. Seller TIN
    ({"seller_tin": None}, ("SELLER_TIN", "missing", "NEEDS_REVIEW")),
    ({"seller_branch": None}, ("SELLER_TIN", "branch_missing", "NEEDS_REVIEW")),
    # 3. Buyer details
    ({"buyer_tin": "999888777"}, ("BUYER_DETAILS", "tin_mismatch", "REJECT")),
    ({"buyer_name": None, "buyer_tin": None, "buyer_tin_raw": None}, ("BUYER_DETAILS", "blank", "REJECT")),
    ({"buyer_name": "23", "buyer_tin": None, "buyer_tin_raw": None}, ("BUYER_DETAILS", "unreadable", "NEEDS_REVIEW")),
    # 4. VAT arithmetic
    ({"vat_amount": 1000}, ("VAT_ARITHMETIC", "mismatch", "NEEDS_REVIEW")),
    ({"vatable_sales": None, "vat_amount": None}, ("VAT_ARITHMETIC", "no_breakdown", "NEEDS_REVIEW")),
    ({"total": None}, ("VAT_ARITHMETIC", "total_missing", "NEEDS_REVIEW")),
    # 6. Date
    ({"date": "2026-03-29"}, ("DATE", "outside_period", "REJECT")),
    ({"date": "2026-05-03"}, ("DATE", "outside_period", "REJECT")),
    ({"date": None}, ("DATE", "missing", "NEEDS_REVIEW")),
])
def test_each_condition(overrides, expected):
    assert expected in conditions(**overrides)


def test_period_is_inclusive_and_name_difference_is_accepted():
    assert conditions(date="2026-03-30") == conditions(date="2026-05-02") == set()
    assert conditions(buyer_name="Bayanihan Demo Corporation, Inc.") == set()   # the TIN decides


def test_buyer_rule_from_1000():
    ctx = Context(CTX.company_tin, "AT_1000_AND_ABOVE", CTX.released_on, CTX.spending_end_on)
    blank = {"buyer_name": None, "buyer_tin": None, "buyer_tin_raw": None}
    assert conditions(blank, ctx=ctx) == set()                                  # ₱355: not required
    big = {**blank, "vatable_sales": 100000, "vat_amount": 12000, "total": 112000}
    assert ("BUYER_DETAILS", "blank", "REJECT") in conditions(big, ctx=ctx)     # ₱1,120: required


def test_auto_repaired_amounts_are_accepted():
    assert conditions(amounts_repaired=True) == set()


def test_duplicate_rejects_only_the_later_receipt():
    key = "240727673|00006|175026"
    earlier = OtherReceipt(3, 7, key, "other-hash")
    later = OtherReceipt(20, 8, key, "x")
    assert ("DUPLICATE", "duplicate", "REJECT") in conditions(others=[earlier])
    assert not {c for c in conditions(others=[later]) if c[0] == "DUPLICATE"}
    assert ("DUPLICATE", "duplicate", "REJECT") in conditions(others=[OtherReceipt(1, 7, None, "h10")])  # same image
    f = next(f for f in run_checks(GOOD, 10, "h10", CTX, [earlier]) if f.check == "DUPLICATE")
    assert f.related_liquidation_id == 7 and "Liquidation #7" in f.message


def test_foreign_receipt_skips_ph_specific_checks():
    found = conditions(currency="USD", doc_type="OTHER", seller_tin=None, buyer_name=None, buyer_tin=None,
                       buyer_tin_raw=None, vatable_sales=None, vat_amount=None)
    assert {c[0] for c in found} == {"DOC_TYPE"}


# ---------- golden: all 18 samples through the fake pipeline ----------

ORDER = [  # originals before their duplicates, so the later photo is the one rejected
    "valid-bf-sinangag", "valid-7eleven", "valid-mrdiy-date-cropped", "valid-lawson-torn", "valid-petron-fuel",
    "valid-landmark-vat-exempt-mix", "valid-llaollao-service-invoice", "nonvat-mouthfeel", "out-of-period-jollibee-2025",
    "or-cebu-2022-multi-finding", "foreign-us-receipt", "amber-handwritten-service-invoice", "mercury-drug-730",
    "goldilocks-seller-tin-covered", "mercury-drug-226-faded", "mercury-drug-458", "bayanihan-corp-1", "bayanihan-corp-2",
    "dup-7eleven-blurry", "dup-mrdiy-rotated",
]

# Reviewed by hand against SPEC §5 (Spending Period 2026-03-30 to 2026-05-02).
EXPECTED_AT_1000 = {
    "valid-bf-sinangag": ("ACCEPTED", set()),
    "valid-7eleven": ("ACCEPTED", set()),
    "valid-mrdiy-date-cropped": ("NEEDS_REVIEW", {"DATE:missing"}),
    "valid-lawson-torn": ("ACCEPTED", set()),                       # amounts auto-repaired
    "valid-petron-fuel": ("NEEDS_REVIEW", {"DOC_TYPE:no_title"}),   # OCR misses the curved title
    "valid-landmark-vat-exempt-mix": ("ACCEPTED", set()),
    "valid-llaollao-service-invoice": ("ACCEPTED", set()),
    "nonvat-mouthfeel": ("NEEDS_REVIEW", {"DOC_TYPE:non_vat", "SELLER_TIN:branch_missing"}),
    "out-of-period-jollibee-2025": ("REJECT", {"DATE:outside_period"}),
    "or-cebu-2022-multi-finding": ("REJECT", {"BUYER_DETAILS:blank", "DATE:outside_period", "DOC_TYPE:official_receipt",
                                              "SELLER_TIN:missing", "VAT_ARITHMETIC:mismatch"}),
    "foreign-us-receipt": ("REJECT", {"DATE:outside_period", "DOC_TYPE:foreign"}),
    "amber-handwritten-service-invoice": ("REJECT", {"BUYER_DETAILS:blank", "DATE:outside_period", "VAT_ARITHMETIC:mismatch"}),
    "mercury-drug-730": ("REJECT", {"DATE:outside_period", "SELLER_TIN:missing"}),
    "goldilocks-seller-tin-covered": ("REJECT", {"DATE:outside_period", "SELLER_TIN:missing", "VAT_ARITHMETIC:mismatch"}),
    "mercury-drug-226-faded": ("NEEDS_REVIEW", {"DATE:missing", "SELLER_TIN:missing"}),
    "mercury-drug-458": ("REJECT", {"DATE:outside_period", "SELLER_TIN:missing"}),
    # The demo receipts carry the Company's name and TIN; dated 2026-10-09, outside this test's period.
    "bayanihan-corp-1": ("REJECT", {"DATE:outside_period"}),
    "bayanihan-corp-2": ("REJECT", {"DATE:outside_period"}),
    # total misread as ₱1,000, which also brings it under the ₱1,000 buyer rule
    "dup-7eleven-blurry": ("REJECT", {"BUYER_DETAILS:blank", "DUPLICATE:duplicate", "VAT_ARITHMETIC:mismatch"}),
    "dup-mrdiy-rotated": ("REJECT", {"DUPLICATE:duplicate"}),
}


def _upload(client, lid, name):
    p = next(SAMPLES.glob(name + ".*"))
    return client.post(f"/api/liquidations/{lid}/receipts", files=[("images", (p.name, p.read_bytes(), "image/jpeg"))]).json()[0]["id"]


def _wait(client, ids, timeout=10.0):
    deadline = time.monotonic() + timeout
    for rid in ids:
        while client.get(f"/api/receipts/{rid}").json()["stage"] != "done":
            assert time.monotonic() < deadline, f"receipt {rid} not done"
            time.sleep(0.02)


def _verdicts(client, ids):
    out = {}
    for name, rid in ids.items():
        r = client.get(f"/api/receipts/{rid}").json()
        out[name] = (r["status"], {f"{f['check']}:{f['condition']}" for f in r["findings"]})
    return out


def _liq(client):
    return client.get("/api/cash-advances").json()[0]["liquidation"]["id"]


def test_golden_all_samples_under_both_rules(clean_client):
    c = clean_client
    lid = _liq(c)
    ids = {n: _upload(c, lid, n) for n in ORDER}
    _wait(c, ids.values())
    c.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"})
    assert _verdicts(c, ids) == EXPECTED_AT_1000

    c.patch("/api/company", json={"buyer_details_rule": "ALL_RECEIPTS"})
    under_all = _verdicts(c, ids)
    # Every receipt without a foreign title now also lacks the Company's details. Petron has "23"
    # handwritten on its Name line, so its buyer details are unreadable rather than blank.
    for name, (status, found) in EXPECTED_AT_1000.items():
        extra = set() if name in ("foreign-us-receipt", "bayanihan-corp-1", "bayanihan-corp-2") else (
            {"BUYER_DETAILS:unreadable"} if name == "valid-petron-fuel" else {"BUYER_DETAILS:blank"})
        assert under_all[name][1] == found | extra, name
    assert under_all["valid-bf-sinangag"][0] == "REJECT" and under_all["valid-petron-fuel"][0] == "NEEDS_REVIEW"


def test_demo_receipt_is_accepted_inside_its_period(clean_client):
    """The printed demo receipt (Company as buyer) passes every check when the Cash Advance covers its date."""
    c = clean_client
    emp = c.get("/api/employees").json()[0]["id"]
    lid = c.post("/api/cash-advances", json={"employee_id": emp, "amount": 5000, "purpose": "Office supplies",
                                             "released_on": "2026-10-01", "spending_end_on": "2026-10-31"}).json()["liquidation"]["id"]
    rid = _upload(c, lid, "bayanihan-corp-1")
    _wait(c, [rid])
    r = c.get(f"/api/receipts/{rid}").json()
    assert r["status"] == "ACCEPTED" and r["findings"] == []
    assert r["effective"]["buyer_tin"] == "123456789" and r["effective"]["invoice_number"] == "SI-000123"
    totals = c.get(f"/api/liquidations/{lid}").json()["totals"]
    assert totals == {"advance": 5000.0, "valid_spend": 666.0, "disallowed": 0.0, "amount_to_return": 4334.0,
                      "excess_spend": 0.0, "claimable_input_vat": 71.36}


# ---------- Reviewer flows ----------

def test_correction_clears_a_misread_and_recomputes_totals(clean_client):
    c = clean_client
    lid = _liq(c)
    c.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"})
    rid = _upload(c, lid, "dup-7eleven-blurry")   # alone, it is just a misread receipt
    _wait(c, [rid])
    r = c.get(f"/api/receipts/{rid}").json()
    assert r["status"] == "REJECT"                  # misread ₱1,000 total brings in the buyer rule
    for field, value in (("total", 284), ("vatable_sales", 253.57), ("vat_amount", 30.43)):
        r = c.post(f"/api/receipts/{rid}/corrections", json={"field": field, "value": value}).json()
    assert r["status"] == "ACCEPTED" and r["findings"] == []
    t = c.get(f"/api/liquidations/{lid}").json()["totals"]
    assert t["valid_spend"] == 284.0 and t["claimable_input_vat"] == 30.43 and t["amount_to_return"] == 14716.0


def test_tin_and_date_corrections_are_normalized(clean_client):
    c = clean_client
    rid = _upload(c, _liq(c), "nonvat-mouthfeel")
    _wait(c, [rid])
    r = c.post(f"/api/receipts/{rid}/corrections", json={"field": "seller_tin", "value": "624-464-614-000"}).json()
    assert r["effective"]["seller_tin"] == "624464614" and r["effective"]["seller_branch"] == "000"
    assert "SELLER_TIN" not in {f["check"] for f in r["findings"]}
    assert c.post(f"/api/receipts/{rid}/corrections", json={"field": "date", "value": "April 5, 2026"}).json()["effective"]["date"] == "2026-04-05"
    for field, value in (("date", "someday"), ("seller_tin", "123"), ("doc_type", "RECEIPT"), ("vat_registered", "yes")):
        assert c.post(f"/api/receipts/{rid}/corrections", json={"field": field, "value": value}).status_code == 422


def test_dismissal_and_confirmation_survive_rechecks(clean_client):
    c = clean_client
    lid = _liq(c)
    c.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"})
    petron, cropped = _upload(c, lid, "valid-petron-fuel"), _upload(c, lid, "valid-mrdiy-date-cropped")
    _wait(c, [petron, cropped])
    f = c.get(f"/api/receipts/{petron}").json()["findings"][0]
    assert c.post(f"/api/findings/{f['id']}/dismiss", json={"reason": "Pump receipt is a sales invoice"}).json()["status"] == "ACCEPTED"
    f = c.get(f"/api/receipts/{cropped}").json()["findings"][0]
    assert c.post(f"/api/findings/{f['id']}/confirm", json={"as": "REJECT"}).json()["status"] == "REJECT"
    for rule in ("ALL_RECEIPTS", "AT_1000_AND_ABOVE"):     # two full re-runs
        c.patch("/api/company", json={"buyer_details_rule": rule})
    p, d = c.get(f"/api/receipts/{petron}").json(), c.get(f"/api/receipts/{cropped}").json()
    assert p["status"] == "ACCEPTED" and p["findings"][0]["state"] == "DISMISSED"
    assert d["status"] == "REJECT" and d["findings"][0]["state"] == "CONFIRMED" and d["findings"][0]["severity"] == "REJECT"
    assert c.post(f"/api/liquidations/{lid}/approve").status_code == 200


def test_duplicate_across_liquidations_and_deleting_the_original(clean_client):
    c = clean_client
    first = _liq(c)
    emp = c.get("/api/employees").json()[0]["id"]
    second = c.post("/api/cash-advances", json={"employee_id": emp, "amount": 2000, "purpose": "Snacks",
                                                "released_on": "2026-04-01", "spending_end_on": "2026-04-30"}).json()["liquidation"]["id"]
    a = _upload(c, first, "valid-7eleven")
    _wait(c, [a])
    b = _upload(c, second, "valid-7eleven")
    _wait(c, [b])
    dup = next(f for f in c.get(f"/api/receipts/{b}").json()["findings"] if f["check"] == "DUPLICATE")
    assert dup["related"] == {"liquidation_id": first} and f"Liquidation #{first}" in dup["message"]
    assert c.delete(f"/api/receipts/{a}").status_code == 204
    assert "DUPLICATE" not in {f["check"] for f in c.get(f"/api/receipts/{b}").json()["findings"]}


def test_approved_liquidation_is_frozen(clean_client):
    c = clean_client
    lid = _liq(c)
    c.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"})
    rid = _upload(c, lid, "valid-bf-sinangag")
    _wait(c, [rid])
    totals = c.post(f"/api/liquidations/{lid}/approve").json()["totals"]
    c.patch("/api/company", json={"buyer_details_rule": "ALL_RECEIPTS"})   # would reject it if still OPEN
    assert c.get(f"/api/receipts/{rid}").json()["status"] == "ACCEPTED"
    assert c.get(f"/api/liquidations/{lid}").json()["totals"] == totals
