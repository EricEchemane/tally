"""Hour-0 contract smoke tests: every route answers in the shape SPEC §7 promises."""
import io

from PIL import Image

from checks.totals import ReceiptMoney, liquidation_totals
from money import to_centavos, to_pesos


def _liquidation(client):
    return client.get("/api/cash-advances").json()[0]["liquidation"]["id"]


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 60), "white").save(buf, "JPEG")
    return buf.getvalue()


def test_money_round_trip():
    assert to_centavos(355) == 35500
    assert to_centavos("282.95") == 28295
    assert to_centavos(0.1 + 0.2) == 30
    assert to_pesos(28295) == 282.95


def test_totals_excess_spend():
    t = liquidation_totals(100_00, [ReceiptMoney("ACCEPTED", 120_00, 12_00), ReceiptMoney("REJECT", 50_00, 0)])
    assert t == {"advance": 10000, "valid_spend": 12000, "disallowed": 5000, "amount_to_return": 0,
                 "excess_spend": 2000, "claimable_input_vat": 1200}


def test_health_in_fake_mode(client):
    h = client.get("/api/health").json()
    assert h["fake_pipeline"] is True and h["queue"] == {"length": 0, "current": None}


def test_company_toggle_emits_event(client):
    assert client.get("/api/company").json()["buyer_details_rule"] == "ALL_RECEIPTS"
    with client.websocket_connect("/ws") as ws:
        assert client.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"}).status_code == 200
        assert ws.receive_json() == {"event": "company.updated", "buyer_details_rule": "AT_1000_AND_ABOVE"}


def test_cash_advance_creates_liquidation(client):
    emp = client.post("/api/employees", json={"name": "Ana Reyes"}).json()
    ca = client.post("/api/cash-advances", json={"employee_id": emp["id"], "amount": 5000, "purpose": "Supplies",
                                                 "released_on": "2026-04-01", "spending_end_on": "2026-04-30"})
    assert ca.status_code == 201
    body = ca.json()
    assert body["amount"] == 5000.0 and body["liquidation"]["status"] == "OPEN"
    assert body["liquidation"]["totals"]["amount_to_return"] == 5000.0
    bad = client.post("/api/cash-advances", json={"employee_id": emp["id"], "amount": 1, "purpose": "x",
                                                  "released_on": "2026-04-30", "spending_end_on": "2026-04-01"})
    assert bad.status_code == 422


def test_placeholder_liquidation_shape(client):
    liq = client.get(f"/api/liquidations/{_liquidation(client)}").json()
    assert set(liq) >= {"id", "status", "cash_advance", "totals", "open_needs_review", "receipts"}
    assert [r["status"] for r in liq["receipts"]] == ["REJECT", "NEEDS_REVIEW", "REJECT", "ACCEPTED"]
    assert liq["totals"]["disallowed"] == 615.0 and liq["open_needs_review"] == 1   # receipts, not Findings
    r = client.get(liq["receipts"][0]["thumbnail_url"].replace("/image", "")).json()
    assert set(r) >= {"extraction", "derived", "corrections", "effective", "findings", "ocr_text"}
    assert client.get(liq["receipts"][0]["thumbnail_url"]).status_code == 200


def test_approve_blocked_then_reviewer_resolves(client):
    lid = _liquidation(client)
    blocked = client.post(f"/api/liquidations/{lid}/approve")
    assert blocked.status_code == 409 and blocked.json()["error"] == "open_needs_review"
    petron = client.get(f"/api/liquidations/{lid}").json()["receipts"][1]["id"]
    findings = client.get(f"/api/receipts/{petron}").json()["findings"]
    assert client.post(f"/api/findings/{findings[0]['id']}/dismiss", json={"reason": ""}).status_code == 422
    assert client.post(f"/api/findings/{findings[0]['id']}/confirm", json={"as": "NO_INPUT_VAT"}).status_code == 422
    client.post(f"/api/findings/{findings[0]['id']}/dismiss", json={"reason": "Pump receipt is a sales invoice"})
    r = client.post(f"/api/findings/{findings[1]['id']}/confirm", json={"as": "REJECT"}).json()
    assert r["status"] == "REJECT"
    approved = client.post(f"/api/liquidations/{lid}/approve")
    assert approved.status_code == 200 and approved.json()["status"] == "APPROVED"


def test_correction_changes_effective_and_totals(client):
    lid = _liquidation(client)
    llaollao = client.get(f"/api/liquidations/{lid}").json()["receipts"][3]["id"]
    r = client.post(f"/api/receipts/{llaollao}/corrections", json={"field": "total", "value": 160}).json()
    assert r["effective"]["total"] == 160.0 and r["corrections"][0]["previous"] == 159.0
    assert client.get(f"/api/liquidations/{lid}").json()["totals"]["valid_spend"] == 442.95
    assert client.post(f"/api/receipts/{llaollao}/corrections", json={"field": "seller_address", "value": "x"}).status_code == 422
    assert client.delete(f"/api/receipts/{llaollao}/corrections/total").json()["effective"]["total"] == 159.0


def test_upload_queues_receipts_and_checks_token(client):
    lid = _liquidation(client)
    files = [("images", ("a.jpg", _jpeg(), "image/jpeg")), ("images", ("b.jpg", _jpeg(), "image/jpeg"))]
    res = client.post(f"/api/liquidations/{lid}/receipts", files=files)
    assert res.status_code == 202 and [r["stage"] for r in res.json()] == ["queued", "queued"]
    assert client.post(f"/api/liquidations/{lid}/receipts?t=wrong", files=files[:1]).status_code == 403
    link = client.get(f"/api/liquidations/{lid}/capture-link").json()
    token = link["url"].split("t=")[1]
    assert f"/capture/{lid}?t=" in link["url"] and link["qr_svg"].startswith("<svg")
    assert client.post(f"/api/liquidations/{lid}/receipts?t={token}", files=files[:1]).status_code == 202
    assert client.post(f"/api/liquidations/{lid}/receipts", files=[("images", ("x.txt", b"hi", "text/plain"))]).status_code == 415


def test_return_and_reopen(client):
    lid = _liquidation(client)
    assert client.post(f"/api/liquidations/{lid}/return", json={"note": "Replace the Official Receipt"}).json()["status"] == "RETURNED"
    assert client.post(f"/api/liquidations/{lid}/approve").status_code == 409
    assert client.post(f"/api/liquidations/{lid}/reopen").json()["status"] == "OPEN"


def test_questions_are_async(client):
    with client.websocket_connect("/ws") as ws:
        qid = client.post("/api/questions", json={"text": "How much input VAT did we lose in April?"}).json()["question_id"]
        while (e := ws.receive_json())["event"] != "question.answered":
            assert e["event"] == "queue.updated"
        assert e == {"event": "question.answered", "question_id": qid}
    q = client.get(f"/api/questions/{qid}").json()
    assert q["state"] == "done" and q["answer"]["how"]["question_id"] == 2
    assert client.get("/api/questions").json()[0]["id"] == qid


def test_export_routes(client):
    xlsx = client.get(f"/api/liquidations/{_liquidation(client)}/summary.xlsx")
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"  # a zip, i.e. an .xlsx
    csv = client.get("/api/exports/slsp.csv?month=2026-04")
    assert csv.status_code == 200 and csv.text.startswith("month_end,seller_tin,")
