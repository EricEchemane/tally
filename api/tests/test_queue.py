"""LLM priority queue, live event sequence and HEIC uploads (SPEC §4, §7)."""
import io
import time
from pathlib import Path

import config
import pytest
from PIL import Image

SAMPLES = Path(__file__).resolve().parents[2] / "samples" / "receipts"


def _liq(c):
    return c.get("/api/cash-advances").json()[0]["liquidation"]["id"]


def _files(*names):
    out = []
    for n in names:
        p = next(SAMPLES.glob(n + ".*"))
        out.append(("images", (p.name, p.read_bytes(), "image/jpeg")))
    return out


def _drain(ws, until, limit=500):
    seen = []
    for _ in range(limit):
        seen.append(ws.receive_json())
        if until(seen):
            return seen
    raise AssertionError("expected event never arrived")


def test_question_jumps_ahead_of_waiting_receipts(clean_client, monkeypatch):
    monkeypatch.setattr(config, "FAKE_DELAY", 0.05)          # extraction ~0.15 s each
    c = clean_client
    with c.websocket_connect("/ws") as ws:
        ids = [r["id"] for r in c.post(f"/api/liquidations/{_liq(c)}/receipts",
                                        files=_files("valid-bf-sinangag", "valid-7eleven", "valid-lawson-torn", "valid-petron-fuel")).json()]
        time.sleep(0.25)                                    # OCR done for all; the first extraction is running
        qid = c.post("/api/questions", json={"text": "What still needs my review?"}).json()["question_id"]
        seen = _drain(ws, lambda s: sum(e["event"] == "receipt.stage" and e["stage"] == "done" for e in s) == 4)
    order = [("q", e["question_id"]) if e["event"] == "question.answered" else ("r", e["receipt_id"])
             for e in seen if e["event"] == "question.answered" or (e["event"] == "receipt.stage" and e["stage"] == "done")]
    assert order.index(("q", qid)) <= 2, order              # answered before at least two waiting receipts finish
    assert [x for x in order if x[0] == "r"] == [("r", i) for i in ids]  # receipts stay in upload order


def test_event_sequence_for_one_receipt(clean_client):
    c = clean_client
    with c.websocket_connect("/ws") as ws:
        (r,) = c.post(f"/api/liquidations/{_liq(c)}/receipts", files=_files("valid-landmark-vat-exempt-mix")).json()
        seen = _drain(ws, lambda s: any(e["event"] == "liquidation.updated" for e in s))
    names = [e["event"] if e["event"] != "receipt.stage" else f"stage:{e['stage']}" for e in seen if e["event"] != "queue.updated"]
    assert names == ["stage:queued", "stage:ocr", "receipt.ocr_done", "stage:extracting", "stage:checking", "stage:done",
                     "receipt.updated", "liquidation.updated"]
    updated = next(e for e in seen if e["event"] == "receipt.updated")
    assert updated["receipt_id"] == r["id"] and updated["status"] == "REJECT"   # demo Company: buyer details on all receipts
    assert seen[-1]["totals"]["disallowed"] == 773.65
    assert any(e["event"] == "queue.updated" and e["length"] == 0 for e in seen) or c.get("/api/health").json()["queue"]["length"] == 0


def test_heic_upload_is_converted(clean_client):
    from pillow_heif import register_heif_opener

    register_heif_opener()
    buf = io.BytesIO()
    Image.open(next(SAMPLES.glob("valid-bf-sinangag.*"))).save(buf, "HEIF", quality=80)
    c = clean_client
    (r,) = c.post(f"/api/liquidations/{_liq(c)}/receipts",
                  files=[("images", ("IMG_0001.HEIC", buf.getvalue(), "image/heic"))]).json()
    deadline = time.monotonic() + 5
    while (d := c.get(f"/api/receipts/{r['id']}").json())["stage"] != "done":
        assert time.monotonic() < deadline
        time.sleep(0.02)
    img = c.get(d["image_url"])
    assert img.status_code == 200 and img.content[:3] == b"\xff\xd8\xff"     # stored as JPEG


@pytest.mark.parametrize("name,fmt,sent_type", [
    ("a.jpg", "JPEG", ""),                           # Windows can drop a .jpg with no type
    ("b.jfif", "JPEG", "application/octet-stream"),
    ("c.jpg", "JPEG", "image/pjpeg"),
    ("d.webp", "WEBP", "image/webp"),
    ("e.bmp", "BMP", "image/bmp"),
])
def test_any_image_is_accepted_whatever_its_reported_type(clean_client, name, fmt, sent_type):
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buf, fmt)
    c = clean_client
    r = c.post(f"/api/liquidations/{_liq(c)}/receipts", files=[("images", (name, buf.getvalue(), sent_type))])
    assert r.status_code == 202, r.text
    img = c.get(f"/api/receipts/{r.json()[0]['id']}/image")
    assert img.status_code == 200 and img.content[:3] in (b"\xff\xd8\xff",)


def test_a_phone_jpeg_is_stored_unchanged(clean_client):
    src = next(SAMPLES.glob("bayanihan-corp-1.*"))  # Pillow reads this phone photo as MPO
    c = clean_client
    (r,) = c.post(f"/api/liquidations/{_liq(c)}/receipts", files=[("images", (src.name, src.read_bytes(), ""))]).json()
    assert c.get(f"/api/receipts/{r['id']}/image").content == src.read_bytes()


def test_a_non_image_is_still_refused(clean_client):
    c = clean_client
    r = c.post(f"/api/liquidations/{_liq(c)}/receipts", files=[("images", ("x.jpg", b"not a picture", "image/jpeg"))])
    assert r.status_code == 415


def test_demo_reset_endpoint(client):
    with client.websocket_connect("/ws") as ws:
        res = client.post("/api/admin/demo-reset").json()
        seen = _drain(ws, lambda s: sum(e["event"] == "liquidation.updated" for e in s) == len(res["liquidations"]))
    assert seen[0] == {"event": "company.updated", "buyer_details_rule": "ALL_RECEIPTS"}
    advances = client.get("/api/cash-advances").json()
    assert {(a["employee"]["name"], a["purpose"]) for a in advances} == {
        ("Juan Dela Cruz", "Field sales trip, South Luzon"), ("Juan Dela Cruz", "Office supplies restock"),
        ("Maria Santos", "Pharmacy and pantry supplies")}


def test_receipt_waits_for_the_model_instead_of_failing(clean_client, monkeypatch):
    """A new desktop install may still be downloading the model when the first receipts arrive."""
    from pipeline import runner

    ready = {"now": False}

    async def model_ready():
        return ready["now"]

    monkeypatch.setattr(runner, "_model_ready", model_ready)
    monkeypatch.setattr(runner, "MODEL_WAIT_SECONDS", 0.05)
    c = clean_client
    (r,) = c.post(f"/api/liquidations/{_liq(c)}/receipts", files=_files("valid-7eleven")).json()
    time.sleep(0.5)
    waiting = c.get(f"/api/receipts/{r['id']}").json()
    assert waiting["stage"] == "extracting" and waiting["error"] is None   # held, not failed
    ready["now"] = True
    for _ in range(100):
        if c.get(f"/api/receipts/{r['id']}").json()["stage"] == "done":
            break
        time.sleep(0.05)
    assert c.get(f"/api/receipts/{r['id']}").json()["stage"] == "done"
