"""LLM priority queue, live event sequence and HEIC uploads (SPEC §4, §7)."""
import io
import time
from pathlib import Path

import config
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
