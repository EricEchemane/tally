"""Demo data (SPEC §9 hours 12–14, §10). Instant and model-free: receipts come from the committed
real-pipeline fixtures (OCR text + extraction), then derive and the checks run as usual.

    ./demo.sh                      # reset + warm the model + print the phone URL (macOS)
    uv run python -m db.demo       # reset only (any OS; the API may keep running)
    POST /api/admin/demo-reset     # reset from a running app; dashboards refresh via live events
"""
import json
import secrets
from pathlib import Path

import db
from money import to_centavos
from pipeline.derive import derive

REPO = Path(__file__).resolve().parents[2]
SAMPLES = REPO / "samples" / "receipts"
FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "receipts"

COMPANY = ("Bayanihan Demo Corp", "12345678900000", "ALL_RECEIPTS")   # demo starts strict; toggle live
EMPLOYEES = ["Juan Dela Cruz", "Maria Santos", "Ana Reyes"]

# (employee, amount, purpose, released_on, spending_end_on, [samples in submission order])
CASH_ADVANCES = [
    # The rule-toggle moment: under ALL_RECEIPTS nearly all are rejected; at ₱1,000+ five turn ✅.
    ("Juan Dela Cruz", 2500, "Field sales trip, South Luzon", "2026-03-30", "2026-05-02", [
        "valid-bf-sinangag", "valid-7eleven", "valid-lawson-torn", "valid-petron-fuel",
        "valid-llaollao-service-invoice", "valid-landmark-vat-exempt-mix", "nonvat-mouthfeel",
        "out-of-period-jollibee-2025"]),
    # The live-scan Liquidation: scan bayanihan-corp-1 (✅) and or-cebu-2022 (REJECT) on stage.
    # The blurry 7-Eleven is a duplicate of the field trip's and has misread amounts (correction beat).
    ("Juan Dela Cruz", 1500, "Office supplies restock", "2026-10-01", "2026-10-31", ["dup-7eleven-blurry"]),
    # Gives "what still needs my review" and per-Employee questions something to show.
    ("Maria Santos", 1500, "Pharmacy and pantry supplies", "2026-09-01", "2026-09-30", [
        "mercury-drug-458", "mercury-drug-730"]),
]

TABLES = ["finding", "correction", "receipt", "question", "liquidation", "cash_advance", "employee", "company"]


def reset(conn) -> list[int]:
    """Wipe every table and load the demo. Returns the Liquidation ids. Runs the checks."""
    from checks import service as checks

    db.init_db(conn)
    for t in TABLES:
        conn.execute(f"DELETE FROM {t}")
    conn.execute("INSERT INTO company (id, name, tin, buyer_details_rule) VALUES (1, ?, ?, ?)", COMPANY)
    emp = {name: conn.execute("INSERT INTO employee (name) VALUES (?)", (name,)).lastrowid for name in EMPLOYEES}
    liquidations = []
    for name, amount, purpose, start, end, samples in CASH_ADVANCES:
        ca = conn.execute(
            "INSERT INTO cash_advance (employee_id, amount, purpose, released_on, spending_end_on) VALUES (?, ?, ?, ?, ?)",
            (emp[name], to_centavos(amount), purpose, start, end)).lastrowid
        lid = conn.execute("INSERT INTO liquidation (cash_advance_id, capture_token) VALUES (?, ?)",
                           (ca, secrets.token_urlsafe(12))).lastrowid
        liquidations.append(lid)
        for sample in samples:
            insert_processed(conn, lid, sample)
    conn.commit()
    checks.recheck_open(conn, publish=False)
    return liquidations


def insert_processed(conn, liquidation_id: int, sample: str) -> int:
    """A receipt exactly as the real pipeline left it (fixture OCR + extraction), checks not yet run."""
    fixture = FIXTURES / sample
    meta = json.loads((fixture / "meta.json").read_text())
    ocr = (fixture / "ocr.txt").read_text()
    extraction = json.loads((fixture / "extraction.json").read_text())
    return conn.execute(
        "INSERT INTO receipt (liquidation_id, stage, image_path, image_hash, rotation, ocr_text, extraction, derived) "
        "VALUES (?, 'done', ?, ?, ?, ?, ?, ?)",
        (liquidation_id, str(SAMPLES / meta["image"]), meta["image_sha256"], meta["rotation"], ocr,
         json.dumps(extraction), json.dumps(derive(extraction, ocr)))).lastrowid


if __name__ == "__main__":
    conn = db.connect()
    ids = reset(conn)
    for lid in ids:
        row = conn.execute(
            "SELECT e.name, c.purpose, COUNT(r.id) FROM liquidation l JOIN cash_advance c ON c.id = l.cash_advance_id "
            "JOIN employee e ON e.id = c.employee_id LEFT JOIN receipt r ON r.liquidation_id = l.id WHERE l.id = ?",
            (lid,)).fetchone()
        print(f"Liquidation #{lid}: {row[0]} — {row[1]} ({row[2]} receipts)")
