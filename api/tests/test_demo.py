"""The demo data (SPEC §10) tells the story the script relies on."""
import time
from pathlib import Path

import db
from checks import service
from db import demo

SAMPLES = Path(__file__).resolve().parents[2] / "samples" / "receipts"


def _statuses(conn, lid):
    return [r[0] for r in conn.execute("SELECT status FROM receipt WHERE liquidation_id = ? ORDER BY id", (lid,))]


def test_demo_story():
    conn = db.connect()
    field_trip, office, pharmacy = demo.reset(conn)
    # Strict start: everything without the Company's details is rejected; Petron needs review.
    assert _statuses(conn, field_trip) == ["REJECT"] * 3 + ["NEEDS_REVIEW"] + ["REJECT"] * 4
    # The blurry 7-Eleven in the October Liquidation is a duplicate of the field trip's.
    dup = conn.execute('SELECT message FROM finding WHERE "check" = \'DUPLICATE\'').fetchone()[0]
    assert f"Liquidation #{field_trip}" in dup
    # The live toggle: five receipts turn accepted.
    conn.execute("UPDATE company SET buyer_details_rule = 'AT_1000_AND_ABOVE'")
    conn.commit()
    service.recheck_open(conn, publish=False)
    assert _statuses(conn, field_trip).count("ACCEPTED") == 5
    assert _statuses(conn, pharmacy) == ["NEEDS_REVIEW", "NEEDS_REVIEW"]
    demo.reset(conn)  # idempotent: a second reset gives the same ids and data
    assert conn.execute("SELECT COUNT(*) FROM receipt").fetchone()[0] == 11
    conn.close()


def test_live_scans_on_the_october_liquidation(clean_client):
    c = clean_client
    lids = c.post("/api/admin/demo-reset").json()["liquidations"]
    office = lids[1]
    ids = []
    for name in ("bayanihan-corp-1", "or-cebu-2022-multi-finding"):
        p = next(SAMPLES.glob(name + ".*"))
        ids.append(c.post(f"/api/liquidations/{office}/receipts", files=[("images", (p.name, p.read_bytes(), "image/jpeg"))]).json()[0]["id"])
    deadline = time.monotonic() + 5
    for rid in ids:
        while c.get(f"/api/receipts/{rid}").json()["stage"] != "done":
            assert time.monotonic() < deadline
            time.sleep(0.02)
    assert [c.get(f"/api/receipts/{r}").json()["status"] for r in ids] == ["ACCEPTED", "REJECT"]
    totals = c.get(f"/api/liquidations/{office}").json()["totals"]
    assert totals["valid_spend"] == 666.0 and totals["amount_to_return"] == 834.0 and totals["claimable_input_vat"] == 71.36
