import sqlite3

import httpx
from fastapi import APIRouter, Depends

import config
import events
import serialize
from db import demo, get_db
from pipeline import runner

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    """Demo pre-flight: is Ollama up and is the model loaded?"""
    if config.FAKE_PIPELINE:
        return {"ollama": "fake", "model": config.MODEL, "model_loaded": True, "fake_pipeline": True,
                "queue": runner.queue_state()}
    try:
        loaded = httpx.get(f"{config.OLLAMA_URL}/api/ps", timeout=2).json().get("models", [])
        ollama, model_loaded = "up", any(m.get("name") == config.MODEL for m in loaded)
    except httpx.HTTPError:
        ollama, model_loaded = "down", False
    return {"ollama": ollama, "model": config.MODEL, "model_loaded": model_loaded, "fake_pipeline": False,
            "queue": runner.queue_state()}


@router.post("/admin/warmup")
def warmup():
    """Load the model and keep it resident (keep_alive -1), and warm Apple Vision: the first OCR after
    a start loads the framework (~1.5 s), which would otherwise land on the first live scan."""
    if config.FAKE_PIPELINE:
        return {"warmed": False, "reason": "fake pipeline"}
    from PIL import Image

    from pipeline.ocr import _recognize

    _recognize(Image.new("RGB", (400, 600), "white"))
    try:
        httpx.post(f"{config.OLLAMA_URL}/api/generate",
                   json={"model": config.MODEL, "prompt": "", "keep_alive": -1}, timeout=120).raise_for_status()
    except httpx.HTTPError as e:
        return {"warmed": False, "reason": str(e)}
    return {"warmed": True}


@router.post("/admin/demo-reset")
def demo_reset(conn: sqlite3.Connection = Depends(get_db)):
    """Reload the demo data (db/demo.py). Open dashboards refresh through live events."""
    liquidation_ids = demo.reset(conn)
    rule = conn.execute("SELECT buyer_details_rule FROM company WHERE id = 1").fetchone()[0]
    events.publish("company.updated", buyer_details_rule=rule)
    for lid in liquidation_ids:
        events.publish("liquidation.updated", liquidation_id=lid, status="OPEN", totals=serialize.totals(conn, lid))
    return {"liquidations": liquidation_ids}
