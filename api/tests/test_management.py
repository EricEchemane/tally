"""Managing records: Employees, deleting and archiving Cash Advances, retrying and moving receipts,
Company settings, the Overview, and the desktop back up / restore."""
import io
import time
import zipfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

import desktop_setup


def _ca(client, purpose="Supplies", employee_id=None, start="2026-04-01", end="2026-05-31"):
    if employee_id is None:
        employee_id = client.get("/api/employees").json()[0]["id"]
    return client.post("/api/cash-advances", json={"employee_id": employee_id, "amount": 1000, "purpose": purpose,
                                                   "released_on": start, "spending_end_on": end}).json()


def _wait_done(client, rid, limit=200):
    for _ in range(limit):
        r = client.get(f"/api/receipts/{rid}").json()
        if r["stage"] in ("done", "failed"):
            return r
        time.sleep(0.02)
    raise AssertionError("receipt never finished")


def test_employees_rename_inactive_and_delete(client):
    emps = {e["name"]: e for e in client.get("/api/employees").json()}
    juan, maria = emps["Juan Dela Cruz"], emps["Maria Santos"]
    assert juan["cash_advances"] == 1 and juan["open_liquidations"] == 1 and juan["active"] is True
    assert client.patch(f"/api/employees/{maria['id']}", json={"name": "Maria R. Santos"}).json()["name"] == "Maria R. Santos"

    # Inactive: history stays, no new Cash Advance; active again lifts that.
    assert client.patch(f"/api/employees/{juan['id']}", json={"active": False}).json()["active"] is False
    blocked = client.post("/api/cash-advances", json={"employee_id": juan["id"], "amount": 1, "purpose": "x",
                                                      "released_on": "2026-04-01", "spending_end_on": "2026-04-30"})
    assert blocked.status_code == 409
    assert client.get("/api/cash-advances").json()[0]["employee"]["active"] is False
    client.patch(f"/api/employees/{juan['id']}", json={"active": True})
    assert _ca(client, employee_id=juan["id"])["id"]

    # Delete only an Employee who never had a Cash Advance.
    assert client.delete(f"/api/employees/{juan['id']}").status_code == 409
    ana = client.post("/api/employees", json={"name": "Ana Reyes"}).json()
    assert client.delete(f"/api/employees/{ana['id']}").status_code == 204
    assert client.delete(f"/api/employees/{ana['id']}").status_code == 404


def test_delete_only_an_empty_cash_advance(client):
    full = client.get("/api/cash-advances").json()[0]
    assert client.delete(f"/api/cash-advances/{full['id']}").status_code == 409   # it has 4 receipts
    empty = _ca(client)
    assert client.delete(f"/api/cash-advances/{empty['id']}").status_code == 204
    assert all(c["id"] != empty["id"] for c in client.get("/api/cash-advances").json())


def test_archive_only_finished_liquidations_and_reopen_unarchives(client):
    ca = client.get("/api/cash-advances").json()[0]
    lid = ca["liquidation"]["id"]
    assert client.post(f"/api/cash-advances/{ca['id']}/archive").status_code == 409   # still OPEN
    client.post(f"/api/liquidations/{lid}/return", json={"note": "Missing invoices"})
    archived = client.post(f"/api/cash-advances/{ca['id']}/archive").json()
    assert archived["archived"] is True
    assert client.get("/api/cash-advances").json() == []                              # off the working list
    assert [c["id"] for c in client.get("/api/cash-advances?archived=true").json()] == [ca["id"]]
    assert client.get("/api/overview?period=ALL").json()["receipts"] == 4             # still counted
    client.post(f"/api/liquidations/{lid}/reopen")
    assert client.get("/api/cash-advances").json()[0]["archived"] is False
    client.post(f"/api/liquidations/{lid}/return", json={"note": "x"})
    client.post(f"/api/cash-advances/{ca['id']}/archive")
    assert client.post(f"/api/cash-advances/{ca['id']}/unarchive").json()["archived"] is False


def test_retry_a_receipt_that_failed(client):
    from db import connect

    liq = client.get(f"/api/liquidations/{client.get('/api/cash-advances').json()[0]['liquidation']['id']}").json()
    rid = liq["receipts"][0]["id"]
    assert client.post(f"/api/receipts/{rid}/retry").status_code == 409               # it didn't fail
    conn = connect()
    conn.execute("UPDATE receipt SET stage = 'failed', error = 'extraction: model offline' WHERE id = ?", (rid,))
    conn.commit()
    conn.close()
    assert client.post(f"/api/receipts/{rid}/retry").json()["stage"] == "queued"
    done = _wait_done(client, rid)
    assert done["stage"] == "done" and done["error"] is None and done["status"] is not None


def test_move_between_the_same_employees_open_liquidations(client):
    src = client.get("/api/cash-advances").json()[0]
    juan = src["employee"]["id"]
    other = _ca(client, "Second trip", employee_id=juan)
    maria = next(e for e in client.get("/api/employees").json() if e["name"] == "Maria Santos")
    marias = _ca(client, "Maria's", employee_id=maria["id"])
    rid = client.get(f"/api/liquidations/{src['liquidation']['id']}").json()["receipts"][3]["id"]

    assert client.post(f"/api/receipts/{rid}/move", json={"liquidation_id": marias["liquidation"]["id"]}).status_code == 409
    assert client.post(f"/api/receipts/{rid}/move", json={"liquidation_id": src["liquidation"]["id"]}).status_code == 422
    moved = client.post(f"/api/receipts/{rid}/move", json={"liquidation_id": other["liquidation"]["id"]}).json()
    assert moved["liquidation_id"] == other["liquidation"]["id"]
    assert len(client.get(f"/api/liquidations/{src['liquidation']['id']}").json()["receipts"]) == 3
    assert len(client.get(f"/api/liquidations/{other['liquidation']['id']}").json()["receipts"]) == 1


def test_company_settings(client):
    c = client.patch("/api/company", json={"name": "Acme Trading Inc.", "tin": "111-222-333-00000"}).json()
    assert c == {"name": "Acme Trading Inc.", "tin": "11122233300000", "buyer_details_rule": "ALL_RECEIPTS"}
    assert client.patch("/api/company", json={"tin": "12-3"}).status_code == 422
    assert client.patch("/api/company", json={"buyer_details_rule": "AT_1000_AND_ABOVE"}).json()["name"] == "Acme Trading Inc."


def test_overview_matches_the_liquidation_totals(client):
    ov = client.get("/api/overview?period=ALL").json()
    totals = client.get("/api/cash-advances").json()[0]["liquidation"]["totals"]
    assert ov["disallowed"] == totals["disallowed"] and ov["valid_spend"] == totals["valid_spend"]
    assert ov["receipts"] == 4 and ov["outstanding"]["open"] == 1
    assert ov["disallowed_reasons"] and all(r["receipt_ids"] for r in ov["disallowed_reasons"])
    assert client.get("/api/overview?period=NEXT_CENTURY").status_code == 422


def test_backup_then_restore_round_trip(client):
    setup = FastAPI()
    setup.include_router(desktop_setup.router)
    admin = TestClient(setup)
    backup = admin.get("/api/setup/backup")
    assert backup.status_code == 200 and backup.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(backup.content)).namelist()
    assert {"manifest.json", "tally.db"} <= set(names) and any(n.startswith("images/") for n in names)

    client.patch("/api/company", json={"name": "Changed after the backup"})
    _ca(client, "Made after the backup")
    res = admin.post("/api/setup/restore", files={"file": ("b.zip", backup.content, "application/zip")})
    assert res.status_code == 200 and res.json()["restored"] is True
    assert client.get("/api/company").json()["name"] != "Changed after the backup"
    assert len(client.get("/api/cash-advances").json()) == 1
    rid = client.get(f"/api/liquidations/{client.get('/api/cash-advances').json()[0]['liquidation']['id']}").json()["receipts"][0]["id"]
    assert client.get(f"/api/receipts/{rid}/image").status_code == 200              # photos came back too
    bad = admin.post("/api/setup/restore", files={"file": ("x.zip", b"not a zip", "application/zip")})
    assert bad.status_code == 422


def test_list_carries_the_counts_for_the_next_step(client):
    ca = client.get("/api/cash-advances").json()[0]
    assert ca["liquidation"]["counts"] == {"receipts": 4, "processing": 0, "failed": 0, "needs_review": 1}
