"""WebSocket hub. Events are invalidation hints with small fields (SPEC §7)."""
import asyncio
import json

from fastapi import WebSocket

_clients: set[WebSocket] = set()
_loop: asyncio.AbstractEventLoop | None = None


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


async def connect(ws: WebSocket) -> None:
    await ws.accept()
    _clients.add(ws)


def disconnect(ws: WebSocket) -> None:
    _clients.discard(ws)


async def _send_all(message: str) -> None:
    for ws in list(_clients):
        try:
            await ws.send_text(message)
        except Exception:
            _clients.discard(ws)


def publish(event: str, **payload) -> None:
    """Fire-and-forget; safe to call from sync route handlers (threadpool) or async code."""
    message = json.dumps({"event": event, **payload})
    if _loop is None:
        return
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None
    if running is _loop:
        _loop.create_task(_send_all(message))
    else:
        asyncio.run_coroutine_threadsafe(_send_all(message), _loop)
