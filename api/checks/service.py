"""Run the checks against the DB, persist Findings, publish events (SPEC §5).

Every change re-runs the checks on all processed receipts of OPEN Liquidations: duplicates span
Liquidations, and the receipt counts are small. APPROVED and RETURNED Liquidations are never touched.
"""
import json
import sqlite3

import events
import serialize
from checks.engine import Context, Finding, OtherReceipt, run_checks
from pipeline.derive import duplicate_key


def _context(conn, liquidation_id: int) -> Context:
    company = conn.execute("SELECT tin, buyer_details_rule FROM company WHERE id = 1").fetchone()
    ca = conn.execute(
        "SELECT c.released_on, c.spending_end_on FROM liquidation l JOIN cash_advance c ON c.id = l.cash_advance_id "
        "WHERE l.id = ?", (liquidation_id,)).fetchone()
    return Context(company["tin"], company["buyer_details_rule"], ca["released_on"], ca["spending_end_on"])


def _effective(conn, row) -> dict:
    eff, _ = serialize.effective(conn, row["id"], json.loads(row["derived"]))
    return eff


def _apply(conn, receipt_id: int, findings: list[Finding]) -> None:
    """Upsert by (check, condition). Dismissed and confirmed Findings keep the Reviewer's decision;
    Findings whose condition no longer holds are removed."""
    existing = {(f["check"], f["condition"]): f for f in conn.execute("SELECT * FROM finding WHERE receipt_id = ?", (receipt_id,))}
    keep = set()
    for f in findings:
        key = (f.check, f.condition)
        keep.add(key)
        if key in existing:
            old = existing[key]
            severity = old["severity"] if old["state"] == "CONFIRMED" else f.severity
            conn.execute("UPDATE finding SET message = ?, severity = ?, amount_affected = ?, related_liquidation_id = ? WHERE id = ?",
                         (f.message, severity, f.amount_affected, f.related_liquidation_id, old["id"]))
        else:
            conn.execute(
                'INSERT INTO finding (receipt_id, "check", condition, severity, message, amount_affected, related_liquidation_id) '
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (receipt_id, f.check, f.condition, f.severity, f.message, f.amount_affected, f.related_liquidation_id))
    for key, old in existing.items():
        if key not in keep:
            conn.execute("DELETE FROM finding WHERE id = ?", (old["id"],))
    conn.execute("UPDATE receipt SET checks_run = 1 WHERE id = ?", (receipt_id,))


def recheck_open(conn: sqlite3.Connection, publish: bool = True) -> set[int]:
    """Re-run the checks on every processed receipt in OPEN Liquidations. Returns affected Liquidation ids."""
    rows = conn.execute(
        "SELECT r.* FROM receipt r JOIN liquidation l ON l.id = r.liquidation_id "
        "WHERE r.stage = 'done' AND r.derived IS NOT NULL ORDER BY r.id").fetchall()
    open_ids = {r[0] for r in conn.execute("SELECT id FROM liquidation WHERE status = 'OPEN'")}
    eff = {r["id"]: _effective(conn, r) for r in rows}
    # Duplicates look across every Liquidation, including approved ones.
    others = [OtherReceipt(r["id"], r["liquidation_id"], duplicate_key(eff[r["id"]]), r["image_hash"]) for r in rows]
    contexts: dict[int, Context] = {}
    changed: list[tuple[int, int, str | None]] = []
    for r in rows:
        lid = r["liquidation_id"]
        if lid not in open_ids:
            continue
        ctx = contexts.setdefault(lid, _context(conn, lid))
        _apply(conn, r["id"], run_checks(eff[r["id"]], r["id"], r["image_hash"], ctx, [o for o in others if o.id != r["id"]]))
        before = r["status"] if r["checks_run"] else "pending"
        after = serialize.refresh_status(conn, r["id"])
        if after != before:
            changed.append((r["id"], lid, after))
    conn.commit()
    affected = {lid for _, lid, _ in changed}
    if publish:
        for rid, lid, status in changed:
            open_findings = conn.execute("SELECT COUNT(*) FROM finding WHERE receipt_id = ? AND state = 'OPEN'", (rid,)).fetchone()[0]
            events.publish("receipt.updated", receipt_id=rid, liquidation_id=lid, status=status, open_findings=open_findings)
        for lid in affected:
            events.publish("liquidation.updated", liquidation_id=lid, status="OPEN", totals=serialize.totals(conn, lid))
    return affected
