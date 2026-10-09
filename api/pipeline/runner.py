"""Receipt runner (SPEC §4, §7): OCR queue -> LLM queue -> derive, with live stage events.

OCR runs outside the LLM queue (Neural Engine), so receipt.ocr_done fires right after upload.
The LLM queue is a priority queue: questions (priority 0) run before waiting receipts (1).
After derive, the checks run on every OPEN Liquidation (duplicates span Liquidations).
"""
import asyncio
import itertools
import json
import logging

import httpx

import config
import db
import events
from checks import service as checks
from pipeline.backends import backend
from pipeline.derive import derive
from questions import service as questions

log = logging.getLogger("tally.runner")

QUESTION_PRIORITY = 0
RECEIPT_PRIORITY = 1
_ocr_queue: asyncio.Queue[int] | None = None
_llm_queue: asyncio.PriorityQueue | None = None
_seq = itertools.count()
_current: dict | None = None
_tasks: list[asyncio.Task] = []
MODEL_WAIT_SECONDS = 5  # how often a receipt re-checks for the model while Ollama or the model is missing


def queue_state() -> dict:
    pending = (_ocr_queue.qsize() if _ocr_queue else 0) + (_llm_queue.qsize() if _llm_queue else 0)
    return {"length": pending + (1 if _current else 0), "current": _current}


def _publish_queue() -> None:
    events.publish("queue.updated", **queue_state())


def enqueue(receipt_id: int) -> int:
    """Returns the receipt's queue position (1 = next)."""
    _ocr_queue.put_nowait(receipt_id)
    _publish_queue()
    return queue_state()["length"]


def enqueue_question(question_id: int) -> None:
    """Questions jump the queue: the worst-case wait is the receipt currently being extracted."""
    _llm_queue.put_nowait((QUESTION_PRIORITY, next(_seq), ("question", question_id)))
    _publish_queue()


def _set_stage(conn, receipt_id: int, stage: str, **fields) -> int:
    sets = ", ".join(["stage = ?"] + [f"{k} = ?" for k in fields])
    conn.execute(f"UPDATE receipt SET {sets} WHERE id = ?", (stage, *fields.values(), receipt_id))
    conn.commit()
    lid = conn.execute("SELECT liquidation_id FROM receipt WHERE id = ?", (receipt_id,)).fetchone()[0]
    events.publish("receipt.stage", receipt_id=receipt_id, liquidation_id=lid, stage=stage,
                   queue_position=queue_state()["length"])
    return lid


def _fail(conn, receipt_id: int, error: str) -> None:
    log.exception("receipt %s failed: %s", receipt_id, error)
    _set_stage(conn, receipt_id, "failed", error=error[:500])
    events.publish("receipt.failed", receipt_id=receipt_id, error=error[:200])


async def _ocr_worker() -> None:
    be = backend()
    while True:
        receipt_id = await _ocr_queue.get()
        conn = db.connect()
        try:
            row = conn.execute("SELECT image_path, cropped_path FROM receipt WHERE id = ?", (receipt_id,)).fetchone()
            if row is None:  # deleted while queued
                continue
            _set_stage(conn, receipt_id, "ocr")
            result = await be.ocr(row["image_path"], row["cropped_path"])
            conn.execute("UPDATE receipt SET ocr_text = ?, rotation = ? WHERE id = ?",
                         (result.text, result.rotation, receipt_id))
            conn.commit()
            preview = " · ".join(line for line in result.text.splitlines()[:3] if line.strip())
            events.publish("receipt.ocr_done", receipt_id=receipt_id, preview=preview[:160])
            _set_stage(conn, receipt_id, "extracting")
            _llm_queue.put_nowait((RECEIPT_PRIORITY, next(_seq), ("receipt", receipt_id)))
            _publish_queue()
        except Exception as e:  # noqa: BLE001 — one bad receipt must not stop the queue
            _fail(conn, receipt_id, f"OCR: {e}")
        finally:
            conn.close()
            _ocr_queue.task_done()


async def _model_ready() -> bool:
    """Is the model installed in a running Ollama? A receipt waits for it instead of failing: on a new
    desktop install the model may still be downloading when the first receipts arrive."""
    if config.FAKE_PIPELINE:
        return True
    try:
        res = await asyncio.to_thread(httpx.get, f"{config.OLLAMA_URL}/api/tags", timeout=2)
        names = {m.get("name") for m in res.json().get("models", [])}
    except (httpx.HTTPError, ValueError):
        return False
    return config.MODEL in names or f"{config.MODEL}:latest" in names


async def _llm_worker() -> None:
    global _current
    be = backend()
    while True:
        item = await _llm_queue.get()
        _priority, _n, (kind, item_id) = item
        if kind == "receipt" and not await _model_ready():
            # Back in line (questions still go first), then look again shortly.
            _llm_queue.task_done()
            await asyncio.sleep(MODEL_WAIT_SECONDS)
            _llm_queue.put_nowait(item)
            continue
        _current = {"kind": kind, "id": item_id}
        _publish_queue()
        conn = db.connect()
        try:
            if kind == "receipt":
                await _process_receipt(conn, be, item_id)
            else:
                await questions.answer(conn, item_id)
                events.publish("question.answered", question_id=item_id)
        except Exception as e:  # noqa: BLE001
            if kind == "receipt":
                _fail(conn, item_id, f"extraction: {e}")
            else:
                log.exception("question %s failed", item_id)
                conn.execute("UPDATE question SET state = 'done', answer = ? WHERE id = ?", (json.dumps(
                    {"kind": "unsupported", "sentence": f"Sorry, I couldn't answer that ({e}).", "supported": []}), item_id))
                conn.commit()
                events.publish("question.answered", question_id=item_id)
        finally:
            conn.close()
            _current = None
            _llm_queue.task_done()
            _publish_queue()


async def _process_receipt(conn, be, receipt_id: int) -> None:
    row = conn.execute("SELECT image_path, ocr_text FROM receipt WHERE id = ?", (receipt_id,)).fetchone()
    if row is None:
        return
    extraction = await be.extract(row["ocr_text"], row["image_path"])
    conn.execute("UPDATE receipt SET extraction = ? WHERE id = ?", (json.dumps(extraction), receipt_id))
    _set_stage(conn, receipt_id, "checking")
    derived = derive(extraction, row["ocr_text"])
    _set_stage(conn, receipt_id, "done", derived=json.dumps(derived), status=None)
    checks.recheck_open(conn)  # publishes receipt.updated + liquidation.updated


def start() -> None:
    """Start the workers on the running loop and resume receipts interrupted by a restart."""
    global _ocr_queue, _llm_queue
    _ocr_queue, _llm_queue = asyncio.Queue(), asyncio.PriorityQueue()
    _tasks[:] = [asyncio.create_task(_ocr_worker()), asyncio.create_task(_llm_worker())]
    conn = db.connect()
    try:
        for r in conn.execute("SELECT id, stage, ocr_text FROM receipt WHERE stage IN ('queued', 'ocr', 'extracting', 'checking') ORDER BY id"):
            if r["ocr_text"] and r["stage"] != "queued":
                _llm_queue.put_nowait((RECEIPT_PRIORITY, next(_seq), ("receipt", r["id"])))
            else:
                _ocr_queue.put_nowait(r["id"])
        for q in conn.execute("SELECT id FROM question WHERE state != 'done' ORDER BY id"):
            _llm_queue.put_nowait((QUESTION_PRIORITY, next(_seq), ("question", q["id"])))
    finally:
        conn.close()


async def stop() -> None:
    for t in _tasks:
        t.cancel()
    await asyncio.gather(*_tasks, return_exceptions=True)
    _tasks.clear()
