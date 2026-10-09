import datetime as dt
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

import events
import serialize
from checks import service as checks
from db import get_db
from db.seed import create_cash_advance
from money import to_centavos

router = APIRouter(prefix="/api")


class EmployeeIn(BaseModel):
    name: str = Field(min_length=1)


@router.get("/employees")
def list_employees(conn: sqlite3.Connection = Depends(get_db)):
    """Every Employee with what the Employees page needs to decide what may be done to them."""
    rows = conn.execute("""
        SELECT e.id, e.name, e.active,
               COUNT(ca.id) AS cash_advances,
               COALESCE(SUM(l.status = 'OPEN'), 0) AS open_liquidations
        FROM employee e
        LEFT JOIN cash_advance ca ON ca.employee_id = e.id
        LEFT JOIN liquidation l ON l.cash_advance_id = ca.id
        GROUP BY e.id ORDER BY e.active DESC, e.name""")
    return [{**dict(r), "active": bool(r["active"])} for r in rows]


class EmployeePatch(BaseModel):
    name: str | None = Field(None, min_length=1)
    active: bool | None = None


@router.patch("/employees/{employee_id}")
def update_employee(employee_id: int, body: EmployeePatch, conn: sqlite3.Connection = Depends(get_db)):
    if not conn.execute("SELECT 1 FROM employee WHERE id = ?", (employee_id,)).fetchone():
        raise HTTPException(404, "employee not found")
    if body.name is not None:
        conn.execute("UPDATE employee SET name = ? WHERE id = ?", (body.name.strip(), employee_id))
    if body.active is not None:
        conn.execute("UPDATE employee SET active = ? WHERE id = ?", (int(body.active), employee_id))
    conn.commit()
    return next(e for e in list_employees(conn) if e["id"] == employee_id)


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, conn: sqlite3.Connection = Depends(get_db)):
    if not conn.execute("SELECT 1 FROM employee WHERE id = ?", (employee_id,)).fetchone():
        raise HTTPException(404, "employee not found")
    if conn.execute("SELECT 1 FROM cash_advance WHERE employee_id = ?", (employee_id,)).fetchone():
        raise HTTPException(409, "this Employee has Cash Advances on record; make them Inactive instead")
    conn.execute("DELETE FROM employee WHERE id = ?", (employee_id,))
    conn.commit()


def _require_active(conn, employee_id: int) -> None:
    e = conn.execute("SELECT active FROM employee WHERE id = ?", (employee_id,)).fetchone()
    if not e:
        raise HTTPException(404, "employee not found")
    if not e["active"]:
        raise HTTPException(409, "this Employee is Inactive; make them active again to give a Cash Advance")


@router.post("/employees", status_code=201)
def create_employee(body: EmployeeIn, conn: sqlite3.Connection = Depends(get_db)):
    eid = conn.execute("INSERT INTO employee (name) VALUES (?)", (body.name.strip(),)).lastrowid
    conn.commit()
    return {"id": eid, "name": body.name.strip()}


class CashAdvanceIn(BaseModel):
    employee_id: int
    amount: float = Field(gt=0)
    purpose: str = Field(min_length=1)
    released_on: dt.date
    spending_end_on: dt.date

    @model_validator(mode="after")
    def _period(self):
        if self.spending_end_on < self.released_on:
            raise ValueError("spending_end_on must be on or after released_on")
        return self


def _cash_advance_with_liquidation(conn, ca):
    liq = conn.execute("SELECT * FROM liquidation WHERE cash_advance_id = ?", (ca["id"],)).fetchone()
    return {**serialize.cash_advance(conn, ca), "liquidation": serialize.liquidation_summary(conn, liq)}


@router.get("/cash-advances")
def list_cash_advances(status: Literal["OPEN", "APPROVED", "RETURNED"] | None = None, archived: bool = False,
                       conn: sqlite3.Connection = Depends(get_db)):
    """The working list by default; archived=true lists only Archived Cash Advances."""
    sql = "SELECT c.* FROM cash_advance c JOIN liquidation l ON l.cash_advance_id = c.id WHERE "
    sql += "c.archived_at IS NOT NULL" if archived else "c.archived_at IS NULL"
    rows = conn.execute(sql + (" AND l.status = ?" if status else "") + " ORDER BY c.released_on DESC, c.id DESC",
                        (status,) if status else ())
    return [_cash_advance_with_liquidation(conn, ca) for ca in rows]


@router.post("/cash-advances", status_code=201)
def create(body: CashAdvanceIn, conn: sqlite3.Connection = Depends(get_db)):
    _require_active(conn, body.employee_id)
    ca_id = create_cash_advance(conn, body.employee_id, to_centavos(body.amount), body.purpose,
                                body.released_on.isoformat(), body.spending_end_on.isoformat())
    conn.commit()
    return _cash_advance_with_liquidation(conn, conn.execute("SELECT * FROM cash_advance WHERE id = ?", (ca_id,)).fetchone())


class CashAdvancePatch(BaseModel):
    """Every field optional: send only what changed."""
    employee_id: int | None = None
    amount: float | None = Field(None, gt=0)
    purpose: str | None = Field(None, min_length=1)
    released_on: dt.date | None = None
    spending_end_on: dt.date | None = None


@router.patch("/cash-advances/{cash_advance_id}")
def update(cash_advance_id: int, body: CashAdvancePatch, conn: sqlite3.Connection = Depends(get_db)):
    ca = conn.execute("SELECT * FROM cash_advance WHERE id = ?", (cash_advance_id,)).fetchone()
    if not ca:
        raise HTTPException(404, "cash advance not found")
    liq = conn.execute("SELECT id, status FROM liquidation WHERE cash_advance_id = ?", (cash_advance_id,)).fetchone()
    if liq["status"] != "OPEN":
        raise HTTPException(409, "only a Cash Advance whose Liquidation is OPEN can be edited (reopen it first)")
    if body.employee_id is not None and body.employee_id != ca["employee_id"]:
        _require_active(conn, body.employee_id)
    fields = {
        "employee_id": body.employee_id,
        "amount": to_centavos(body.amount) if body.amount is not None else None,
        "purpose": body.purpose.strip() if body.purpose is not None else None,
        "released_on": body.released_on.isoformat() if body.released_on else None,
        "spending_end_on": body.spending_end_on.isoformat() if body.spending_end_on else None,
    }
    new = {k: v if v is not None else ca[k] for k, v in fields.items()}
    if new["spending_end_on"] < new["released_on"]:
        raise HTTPException(422, "spending_end_on must be on or after released_on")
    conn.execute("UPDATE cash_advance SET employee_id = ?, amount = ?, purpose = ?, released_on = ?, spending_end_on = ? "
                 "WHERE id = ?", (*new.values(), cash_advance_id))
    conn.commit()
    # The Spending Period feeds the date check; the amount feeds the totals. Re-run, then always tell the
    # dashboard: an amount change moves the totals even when no receipt's status changes.
    checks.recheck_open(conn)
    events.publish("liquidation.updated", liquidation_id=liq["id"], status="OPEN", totals=serialize.totals(conn, liq["id"]))
    return _cash_advance_with_liquidation(conn, conn.execute("SELECT * FROM cash_advance WHERE id = ?", (cash_advance_id,)).fetchone())



def _load_ca(conn, cash_advance_id: int):
    ca = conn.execute("SELECT * FROM cash_advance WHERE id = ?", (cash_advance_id,)).fetchone()
    if not ca:
        raise HTTPException(404, "cash advance not found")
    liq = conn.execute("SELECT id, status FROM liquidation WHERE cash_advance_id = ?", (cash_advance_id,)).fetchone()
    return ca, liq


@router.delete("/cash-advances/{cash_advance_id}", status_code=204)
def delete_cash_advance(cash_advance_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Only an empty one: receipts are evidence, so they are deleted one by one first, on purpose."""
    _ca, liq = _load_ca(conn, cash_advance_id)
    n = conn.execute("SELECT COUNT(*) FROM receipt WHERE liquidation_id = ?", (liq["id"],)).fetchone()[0]
    if n:
        raise HTTPException(409, f"this Cash Advance has {n} receipt{'s' if n != 1 else ''}; delete them first, or archive it")
    conn.execute("DELETE FROM liquidation WHERE id = ?", (liq["id"],))
    conn.execute("DELETE FROM cash_advance WHERE id = ?", (cash_advance_id,))
    conn.commit()


@router.post("/cash-advances/{cash_advance_id}/archive")
def archive(cash_advance_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _ca, liq = _load_ca(conn, cash_advance_id)
    if liq["status"] == "OPEN":
        raise HTTPException(409, "only an Approved or Returned Liquidation can be archived")
    conn.execute("UPDATE cash_advance SET archived_at = datetime('now') WHERE id = ?", (cash_advance_id,))
    conn.commit()
    return _cash_advance_with_liquidation(conn, _load_ca(conn, cash_advance_id)[0])


@router.post("/cash-advances/{cash_advance_id}/unarchive")
def unarchive(cash_advance_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _load_ca(conn, cash_advance_id)
    conn.execute("UPDATE cash_advance SET archived_at = NULL WHERE id = ?", (cash_advance_id,))
    conn.commit()
    return _cash_advance_with_liquidation(conn, _load_ca(conn, cash_advance_id)[0])
