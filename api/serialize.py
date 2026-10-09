"""Build contract-shaped payloads from DB rows (SPEC §7). Centavos in, pesos out."""
import json
import sqlite3

from checks.status import receipt_status
from checks.totals import ReceiptMoney, liquidation_totals
from money import to_pesos

AMOUNT_FIELDS = {"vatable_sales", "vat_amount", "vat_exempt_sales", "zero_rated_sales", "total", "withholding_tax"}
EDITABLE_FIELDS = {
    "seller_tin", "seller_branch", "invoice_number", "date",
    "vatable_sales", "vat_amount", "vat_exempt_sales", "zero_rated_sales", "total",
    "buyer_name", "buyer_tin", "doc_type", "vat_registered", "expense_category", "particulars", "withholding_tax",
    "seller_name",  # display-only, but OCR often misses or garbles the store name (logos, torn or faded headers)
}


def _amounts_to_pesos(d: dict) -> dict:
    return {k: (to_pesos(v) if k in AMOUNT_FIELDS else v) for k, v in d.items()}


def effective(conn: sqlite3.Connection, receipt_id: int, derived: dict) -> tuple[dict, list[dict]]:
    """Effective value = correction if present, else derived. Returns (effective, corrections), centavos."""
    eff = dict(derived)
    corrections = []
    for c in conn.execute("SELECT field, value, previous, at FROM correction WHERE receipt_id = ? ORDER BY at", (receipt_id,)):
        value, previous = json.loads(c["value"]), json.loads(c["previous"]) if c["previous"] else None
        eff[c["field"]] = value
        corrections.append({"field": c["field"], "value": value, "previous": previous, "at": c["at"]})
    return eff, corrections


def findings(conn: sqlite3.Connection, receipt_id: int) -> list[dict]:
    rows = conn.execute('SELECT * FROM finding WHERE receipt_id = ? ORDER BY id', (receipt_id,))
    return [
        {
            "id": f["id"], "check": f["check"], "condition": f["condition"], "severity": f["severity"], "state": f["state"],
            "message": f["message"], "amount_affected": to_pesos(f["amount_affected"]),
            "related": {"liquidation_id": f["related_liquidation_id"]} if f["related_liquidation_id"] else None,
            "dismissal_reason": f["dismissal_reason"],
        }
        for f in rows
    ]


def refresh_status(conn: sqlite3.Connection, receipt_id: int) -> str | None:
    """Recompute Receipt Status from open Findings (only once the receipt is processed)."""
    r = conn.execute("SELECT stage, checks_run FROM receipt WHERE id = ?", (receipt_id,)).fetchone()
    if r["stage"] != "done" or not r["checks_run"]:
        return None  # still processing, or "checks pending"
    open_sev = [f["severity"] for f in conn.execute(
        "SELECT severity FROM finding WHERE receipt_id = ? AND state IN ('OPEN', 'CONFIRMED')", (receipt_id,))]
    status = receipt_status(open_sev)
    conn.execute("UPDATE receipt SET status = ? WHERE id = ?", (status, receipt_id))
    return status


def receipt_detail(conn: sqlite3.Connection, r: sqlite3.Row) -> dict:
    derived = json.loads(r["derived"]) if r["derived"] else {}
    eff, corrections = effective(conn, r["id"], derived)
    return {
        "id": r["id"], "liquidation_id": r["liquidation_id"], "stage": r["stage"], "status": r["status"],
        "checks_pending": r["stage"] == "done" and not r["checks_run"], "error": r["error"],
        "image_url": f"/api/receipts/{r['id']}/image", "rotation": r["rotation"],
        "ocr_text": r["ocr_text"],
        "extraction": json.loads(r["extraction"]) if r["extraction"] else None,
        "derived": _amounts_to_pesos(derived) if r["derived"] else None,
        "corrections": [
            {**c, "value": to_pesos(c["value"]) if c["field"] in AMOUNT_FIELDS else c["value"],
             "previous": to_pesos(c["previous"]) if c["field"] in AMOUNT_FIELDS else c["previous"]}
            for c in corrections
        ],
        "effective": _amounts_to_pesos(eff) if r["derived"] else None,
        "findings": findings(conn, r["id"]),
    }


def _employee(conn, employee_id):
    e = conn.execute("SELECT id, name FROM employee WHERE id = ?", (employee_id,)).fetchone()
    return {"id": e["id"], "name": e["name"]}


def cash_advance(conn: sqlite3.Connection, ca: sqlite3.Row) -> dict:
    return {
        "id": ca["id"], "employee": _employee(conn, ca["employee_id"]), "amount": to_pesos(ca["amount"]),
        "purpose": ca["purpose"], "released_on": ca["released_on"], "spending_end_on": ca["spending_end_on"],
    }


def totals_centavos(conn: sqlite3.Connection, liquidation_id: int) -> dict[str, int]:
    liq = conn.execute(
        "SELECT l.frozen_totals, c.amount FROM liquidation l JOIN cash_advance c ON c.id = l.cash_advance_id WHERE l.id = ?",
        (liquidation_id,)).fetchone()
    if liq["frozen_totals"]:
        return json.loads(liq["frozen_totals"])
    money = []
    for r in conn.execute("SELECT id, status, derived FROM receipt WHERE liquidation_id = ?", (liquidation_id,)):
        eff, _ = effective(conn, r["id"], json.loads(r["derived"]) if r["derived"] else {})
        money.append(ReceiptMoney(r["status"], eff.get("total"), eff.get("vat_amount")))
    return liquidation_totals(liq["amount"], money)


def totals(conn: sqlite3.Connection, liquidation_id: int) -> dict[str, float]:
    return {k: to_pesos(v) for k, v in totals_centavos(conn, liquidation_id).items()}


def liquidation_summary(conn: sqlite3.Connection, liq: sqlite3.Row) -> dict:
    return {"id": liq["id"], "status": liq["status"], "totals": totals(conn, liq["id"])}


def liquidation_detail(conn: sqlite3.Connection, liq: sqlite3.Row) -> dict:
    ca = conn.execute("SELECT * FROM cash_advance WHERE id = ?", (liq["cash_advance_id"],)).fetchone()
    receipts = []
    for r in conn.execute("SELECT * FROM receipt WHERE liquidation_id = ? ORDER BY id", (liq["id"],)):
        derived = json.loads(r["derived"]) if r["derived"] else {}
        eff, _ = effective(conn, r["id"], derived)
        open_findings = conn.execute(
            "SELECT COUNT(*) FROM finding WHERE receipt_id = ? AND state = 'OPEN'", (r["id"],)).fetchone()[0]
        receipts.append({
            "id": r["id"], "stage": r["stage"], "status": r["status"],
            "checks_pending": r["stage"] == "done" and not r["checks_run"], "seller_name": eff.get("seller_name"),
            "date": eff.get("date"), "total": to_pesos(eff.get("total")),
            "thumbnail_url": f"/api/receipts/{r['id']}/image", "open_findings": open_findings,
        })
    # Receipts whose status is NEEDS_REVIEW: the ones that block approval.
    open_needs_review = conn.execute(
        "SELECT COUNT(*) FROM receipt WHERE liquidation_id = ? AND status = 'NEEDS_REVIEW'", (liq["id"],)).fetchone()[0]
    return {
        "id": liq["id"], "status": liq["status"], "return_note": liq["return_note"],
        "cash_advance": cash_advance(conn, ca), "totals": totals(conn, liq["id"]),
        "open_needs_review": open_needs_review, "receipts": receipts,
    }
