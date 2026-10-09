import httpx
from fastapi import APIRouter

import config
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
    """Load the model and keep it resident (keep_alive -1)."""
    if config.FAKE_PIPELINE:
        return {"warmed": False, "reason": "fake pipeline"}
    try:
        httpx.post(f"{config.OLLAMA_URL}/api/generate",
                   json={"model": config.MODEL, "prompt": "", "keep_alive": -1}, timeout=120).raise_for_status()
    except httpx.HTTPError as e:
        return {"warmed": False, "reason": str(e)}
    return {"warmed": True}
