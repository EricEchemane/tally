import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import config
import events
import serialize
from db import get_db
from money import to_centavos
from checks import service as checks
from pipeline import runner
from pipeline.derive import parse_date
from pipeline.ingest import save_upload
from routes.liquidations import load as load_liquidation

router = APIRouter(prefix="/api")

ALLOWED = {"image/jpeg", "image/png", "image/heic", "image/heif"}


def load(conn, receipt_id: int) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM receipt WHERE id = ?", (receipt_id,)).fetchone()
    if not r:
        raise HTTPException(404, "receipt not found")
    return r


def _require_open(conn, liquidation_id):
    if load_liquidation(conn, liquidation_id)["status"] != "OPEN":
        raise HTTPException(409, "liquidation is not OPEN")


@router.post("/liquidations/{liquidation_id}/receipts", status_code=202)
async def upload(liquidation_id: int, images: list[UploadFile] = File(...),
                 t: str | None = Query(None), conn: sqlite3.Connection = Depends(get_db)):
    # The phone capture page sends ?t=<capture_token>; the dashboard omits it (per the contract).
    # Demo-grade: the dashboard itself is unauthenticated on the office LAN.
    liq = load_liquidation(conn, liquidation_id)
    if t is not None and t != liq["capture_token"]:
        raise HTTPException(403, "invalid capture token")
    _require_open(conn, liquidation_id)
    created = []
    for img in images:
        if img.content_type not in ALLOWED:
            raise HTTPException(415, f"unsupported file type {img.content_type}")
        path, digest = save_upload(await img.read(), img.content_type, config.IMAGES_DIR)
        rid = conn.execute(
            "INSERT INTO receipt (liquidation_id, image_path, image_hash) VALUES (?, ?, ?)",
            (liquidation_id, str(path), digest)).lastrowid
        created.append(rid)
    conn.commit()
    out = []
    for rid in created:
        pos = runner.enqueue(rid)
        events.publish("receipt.stage", receipt_id=rid, liquidation_id=liquidation_id, stage="queued", queue_position=pos)
        out.append({"id": rid, "stage": "queued", "queue_position": pos})
    return out


@router.get("/receipts/{receipt_id}")
def get(receipt_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return serialize.receipt_detail(conn, load(conn, receipt_id))


@router.get("/receipts/{receipt_id}/image")
def image(receipt_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return FileResponse(load(conn, receipt_id)["image_path"])


@router.delete("/receipts/{receipt_id}", status_code=204)
def delete(receipt_id: int, conn: sqlite3.Connection = Depends(get_db)):
    r = load(conn, receipt_id)
    _require_open(conn, r["liquidation_id"])
    conn.execute("DELETE FROM receipt WHERE id = ?", (receipt_id,))
    conn.commit()
    checks.recheck_open(conn)  # a duplicate of this receipt may now be the original
    events.publish("liquidation.updated", liquidation_id=r["liquidation_id"], status="OPEN",
                   totals=serialize.totals(conn, r["liquidation_id"]))


def _after_change(conn, r) -> dict:
    """Shared tail of every Reviewer action: re-run the checks, then publish this receipt's state."""
    conn.commit()
    checks.recheck_open(conn)
    status = conn.execute("SELECT status FROM receipt WHERE id = ?", (r["id"],)).fetchone()[0]
    open_findings = conn.execute(
        "SELECT COUNT(*) FROM finding WHERE receipt_id = ? AND state = 'OPEN'", (r["id"],)).fetchone()[0]
    events.publish("receipt.updated", receipt_id=r["id"], liquidation_id=r["liquidation_id"],
                   status=status, open_findings=open_findings)
    events.publish("liquidation.updated", liquidation_id=r["liquidation_id"], status="OPEN",
                   totals=serialize.totals(conn, r["liquidation_id"]))
    return serialize.receipt_detail(conn, load(conn, r["id"]))


class CorrectionIn(BaseModel):
    field: str
    value: Any


@router.post("/receipts/{receipt_id}/corrections")
def correct(receipt_id: int, body: CorrectionIn, conn: sqlite3.Connection = Depends(get_db)):
    r = load(conn, receipt_id)
    _require_open(conn, r["liquidation_id"])
    if body.field not in serialize.EDITABLE_FIELDS:
        raise HTTPException(422, f"field '{body.field}' is not editable")
    if r["derived"] is None:
        raise HTTPException(409, "receipt is still processing")
    current, _ = serialize.effective(conn, receipt_id, json.loads(r["derived"]))
    for field, value in _normalize(body.field, body.value).items():
        conn.execute(
            "INSERT INTO correction (receipt_id, field, value, previous) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (receipt_id, field) DO UPDATE SET value = excluded.value, at = datetime('now')",
            (receipt_id, field, json.dumps(value), json.dumps(current.get(field))))
    return _after_change(conn, r)


ENUMS = {"doc_type": {"INVOICE", "OFFICIAL_RECEIPT", "OTHER"},
         "expense_category": {"MEALS", "TRANSPORT_FUEL", "LODGING", "SUPPLIES", "OTHER"}}


def _normalize(field: str, value: Any) -> dict[str, Any]:
    """Validate a Reviewer's value and store it in the derived layer's shape (centavos, digits, ISO)."""
    def bad(why):
        raise HTTPException(422, f"invalid {field}: {why}")

    if value is None or value == "":
        return {field: None}
    if field in serialize.AMOUNT_FIELDS:
        try:
            return {field: to_centavos(value)}
        except Exception:
            bad("not an amount")
    if field in ("seller_tin", "buyer_tin"):
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        if len(digits) == 9:
            return {field: digits}
        if field == "seller_tin" and 12 <= len(digits) <= 14:   # typed with the branch code
            return {"seller_tin": digits[:9], "seller_branch": digits[9:]}
        bad("a TIN has 9 digits (plus a 3–5 digit branch for the seller)")
    if field == "seller_branch":
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        return {field: digits} if 3 <= len(digits) <= 5 else bad("a branch code has 3–5 digits")
    if field == "date":
        iso = parse_date(str(value))
        return {field: iso} if iso else bad("not a date")
    if field == "vat_registered":
        return {field: bool(value)} if isinstance(value, bool) else bad("must be true or false")
    if field in ENUMS:
        return {field: value} if value in ENUMS[field] else bad(f"must be one of {sorted(ENUMS[field])}")
    text = " ".join(str(value).split())
    return {field: text} if len(text) <= 120 else bad("at most 120 characters")


@router.delete("/receipts/{receipt_id}/corrections/{field}")
def revert(receipt_id: int, field: str, conn: sqlite3.Connection = Depends(get_db)):
    r = load(conn, receipt_id)
    _require_open(conn, r["liquidation_id"])
    conn.execute("DELETE FROM correction WHERE receipt_id = ? AND field = ?", (receipt_id, field))
    return _after_change(conn, r)


def _load_finding(conn, finding_id):
    f = conn.execute("SELECT * FROM finding WHERE id = ?", (finding_id,)).fetchone()
    if not f:
        raise HTTPException(404, "finding not found")
    r = load(conn, f["receipt_id"])
    _require_open(conn, r["liquidation_id"])
    return f, r


class DismissIn(BaseModel):
    reason: str = Field(min_length=1)


@router.post("/findings/{finding_id}/dismiss")
def dismiss(finding_id: int, body: DismissIn, conn: sqlite3.Connection = Depends(get_db)):
    f, r = _load_finding(conn, finding_id)
    if not body.reason.strip():
        raise HTTPException(422, "a dismissal needs a reason")
    conn.execute("UPDATE finding SET state = 'DISMISSED', dismissal_reason = ? WHERE id = ?", (body.reason.strip(), f["id"]))
    return _after_change(conn, r)


class ConfirmIn(BaseModel):
    as_: Literal["REJECT", "NO_INPUT_VAT"] = Field(alias="as")


@router.post("/findings/{finding_id}/confirm")
def confirm(finding_id: int, body: ConfirmIn, conn: sqlite3.Connection = Depends(get_db)):
    f, r = _load_finding(conn, finding_id)
    if f["severity"] != "NEEDS_REVIEW" or f["state"] != "OPEN":
        raise HTTPException(409, "only an open NEEDS_REVIEW finding can be confirmed")
    if body.as_ == "NO_INPUT_VAT" and f["check"] != "VAT_ARITHMETIC":
        raise HTTPException(422, "NO_INPUT_VAT is only allowed for the VAT arithmetic check")
    conn.execute("UPDATE finding SET state = 'CONFIRMED', severity = ? WHERE id = ?", (body.as_, f["id"]))
    return _after_change(conn, r)
