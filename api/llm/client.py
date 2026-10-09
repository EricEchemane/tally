"""Thin Ollama client with the settings from SPEC §2."""
import json

import httpx

import config


class LlmError(RuntimeError):
    pass


def chat_json(system: str, user: str, schema: dict, num_predict: int = 600) -> dict:
    """One structured call. think=false, temperature 0, JSON Schema-constrained output."""
    body = {
        "model": config.MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "format": schema,
        "stream": False,
        "think": False,
        "keep_alive": -1,
        "options": {"temperature": 0, "num_ctx": 4096, "num_predict": num_predict},
    }
    try:
        res = httpx.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=180)
        res.raise_for_status()
        return json.loads(res.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, json.JSONDecodeError) as e:
        raise LlmError(f"extraction call failed: {e}") from e
