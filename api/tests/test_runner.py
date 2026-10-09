"""Receipt runner in fake pipeline mode (SPEC §2, §4): upload -> OCR -> extraction -> derive, live."""
import time
from pathlib import Path

import pytest

from pipeline import backends, runner

SAMPLES = Path(__file__).resolve().parents[2] / "samples" / "receipts"


def _liquidation(client):
    return client.get("/api/cash-advances").json()[0]["liquidation"]["id"]


def _upload(client, lid, *paths):
    files = [("images", (p.name, p.read_bytes(), "image/jpeg")) for p in paths]
    res = client.post(f"/api/liquidations/{lid}/receipts", files=files)
    assert res.status_code == 202
    return [r["id"] for r in res.json()]


def _wait_done(client, rid, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        r = client.get(f"/api/receipts/{rid}").json()
        if r["stage"] in ("done", "failed"):
            return r
        time.sleep(0.02)
    raise AssertionError(f"receipt {rid} stuck at {r['stage']}")


def test_known_sample_replays_its_real_fixture(client):
    lid = _liquidation(client)
    with client.websocket_connect("/ws") as ws:
        (rid,) = _upload(client, lid, SAMPLES / "valid-bf-sinangag.jpg")
        r = _wait_done(client, rid)
        seen = []
        while not {"receipt.ocr_done", "receipt.updated", "liquidation.updated"} <= {e["event"] for e in seen}:
            seen.append(ws.receive_json())
    stages = [e["stage"] for e in seen if e["event"] == "receipt.stage"]
    assert stages[0] == "queued" and stages[-1] == "done" and "extracting" in stages
    assert next(e for e in seen if e["event"] == "receipt.ocr_done")["preview"].startswith("BF SINANGAG")
    assert r["derived"]["seller_tin"] == "240727673" and r["derived"]["total"] == 355.0
    assert r["effective"]["date"] == "2026-04-03" and r["ocr_text"] and r["extraction"]
    # Checks run right after derive: the demo Company requires buyer details on every receipt.
    assert r["status"] == "REJECT" and r["checks_pending"] is False
    # The seeded placeholders already hold this exact photo, so it is also caught as a duplicate.
    assert {(f["check"], f["severity"]) for f in r["findings"]} == {("BUYER_DETAILS", "REJECT"), ("DUPLICATE", "REJECT")}
    summary = next(x for x in client.get(f"/api/liquidations/{lid}").json()["receipts"] if x["id"] == rid)
    assert summary["status"] == "REJECT" and summary["seller_name"]


def test_unknown_image_still_flows_through_a_fixture(client):
    (rid,) = _upload(client, _liquidation(client), SAMPLES / "valid-7eleven.jpg")
    assert _wait_done(client, rid)["stage"] == "done"
    from tests.test_scaffold import _jpeg
    files = [("images", ("blank.jpg", _jpeg(), "image/jpeg"))]
    rid = client.post(f"/api/liquidations/{_liquidation(client)}/receipts", files=files).json()[0]["id"]
    r = _wait_done(client, rid)
    assert r["stage"] == "done" and r["extraction"] is not None


def test_failure_marks_receipt_failed_and_queue_continues(client, monkeypatch):
    async def boom(self, text, path):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(backends.FakeBackend, "extract", boom)
    lid = _liquidation(client)
    a, b = _upload(client, lid, SAMPLES / "valid-lawson-torn.jpg", SAMPLES / "valid-petron-fuel.jpg")
    for rid in (a, b):
        r = _wait_done(client, rid)
        assert r["stage"] == "failed" and "model unavailable" in r["error"]


def test_health_reports_queue(client):
    assert client.get("/api/health").json()["queue"] == {"length": 0, "current": None}


@pytest.mark.parametrize("stage", ["queued", "extracting"])
def test_restart_resumes_unfinished_receipts(client, stage):
    import db
    lid = _liquidation(client)
    image = SAMPLES / "nonvat-mouthfeel.jpg"
    conn = db.connect()
    ocr = (Path(backends.FIXTURES) / "nonvat-mouthfeel" / "ocr.txt").read_text() if stage == "extracting" else None
    rid = conn.execute("INSERT INTO receipt (liquidation_id, stage, image_path, image_hash, ocr_text) VALUES (?, ?, ?, 'x', ?)",
                       (lid, stage, str(image), ocr)).lastrowid
    conn.commit()
    conn.close()
    import main
    from fastapi.testclient import TestClient
    client.__exit__(None, None, None)            # stop the app ...
    with TestClient(main.app) as restarted:      # ... and start it again on the same DB
        r = _wait_done(restarted, rid)
    assert r["stage"] == "done" and r["derived"]["seller_tin"] == "624464614"
