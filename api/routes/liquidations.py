import json
import sqlite3

import segno
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import config
import events
import serialize
from db import get_db

router = APIRouter(prefix="/api/liquidations")


def load(conn, liquidation_id: int) -> sqlite3.Row:
    liq = conn.execute("SELECT * FROM liquidation WHERE id = ?", (liquidation_id,)).fetchone()
    if not liq:
        raise HTTPException(404, "liquidation not found")
    return liq


def _set_status(conn, liquidation_id, status, **extra):
    sets = ", ".join(["status = ?", "updated_at = datetime('now')"] + [f"{k} = ?" for k in extra])
    conn.execute(f"UPDATE liquidation SET {sets} WHERE id = ?", (status, *extra.values(), liquidation_id))
    conn.commit()
    events.publish("liquidation.updated", liquidation_id=liquidation_id, status=status,
                   totals=serialize.totals(conn, liquidation_id))
    return serialize.liquidation_detail(conn, load(conn, liquidation_id))


@router.get("/{liquidation_id}")
def get(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return serialize.liquidation_detail(conn, load(conn, liquidation_id))


@router.post("/{liquidation_id}/approve")
def approve(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    liq = load(conn, liquidation_id)
    if liq["status"] != "OPEN":
        raise HTTPException(409, f"liquidation is {liq['status']}")
    # Only receipts still undecided block approval. A NEEDS_REVIEW Finding on a receipt that is already
    # rejected changes nothing: its whole amount is disallowed either way.
    blocking = [r[0] for r in conn.execute(
        "SELECT id FROM receipt WHERE liquidation_id = ? AND status = 'NEEDS_REVIEW' ORDER BY id", (liquidation_id,))]
    still_processing = conn.execute(
        "SELECT COUNT(*) FROM receipt WHERE liquidation_id = ? AND stage NOT IN ('done', 'failed')", (liquidation_id,)
    ).fetchone()[0]
    if blocking or still_processing:
        return JSONResponse(status_code=409, content={
            "error": "open_needs_review" if blocking else "receipts_processing", "receipt_ids": blocking})
    frozen = json.dumps(serialize.totals_centavos(conn, liquidation_id))
    return _set_status(conn, liquidation_id, "APPROVED", frozen_totals=frozen)


class ReturnIn(BaseModel):
    note: str | None = None


@router.post("/{liquidation_id}/return")
def return_(liquidation_id: int, body: ReturnIn | None = None, conn: sqlite3.Connection = Depends(get_db)):
    if load(conn, liquidation_id)["status"] != "OPEN":
        raise HTTPException(409, "only an OPEN liquidation can be returned")
    return _set_status(conn, liquidation_id, "RETURNED", return_note=body.note if body else None)


@router.post("/{liquidation_id}/reopen")
def reopen(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    if load(conn, liquidation_id)["status"] != "RETURNED":
        raise HTTPException(409, "only a RETURNED liquidation can be reopened")
    return _set_status(conn, liquidation_id, "OPEN")


@router.get("/{liquidation_id}/capture-link")
def capture_link(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    liq = load(conn, liquidation_id)
    url = f"{config.WEB_URL}/capture/{liquidation_id}?t={liq['capture_token']}"
    # viewBox instead of a fixed width/height, so the UI can size it (a fixed 246 px SVG got cropped)
    return {"url": url, "qr_svg": segno.make(url, error="m").svg_inline(scale=6, omitsize=True, light="#fff")}
