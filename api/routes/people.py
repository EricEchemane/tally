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
    return [dict(e) for e in conn.execute("SELECT id, name FROM employee ORDER BY name")]


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
def list_cash_advances(status: Literal["OPEN", "APPROVED", "RETURNED"] | None = None,
                       conn: sqlite3.Connection = Depends(get_db)):
    sql = "SELECT c.* FROM cash_advance c JOIN liquidation l ON l.cash_advance_id = c.id"
    rows = conn.execute(sql + (" WHERE l.status = ?" if status else "") + " ORDER BY c.released_on DESC, c.id DESC",
                        (status,) if status else ())
    return [_cash_advance_with_liquidation(conn, ca) for ca in rows]


@router.post("/cash-advances", status_code=201)
def create(body: CashAdvanceIn, conn: sqlite3.Connection = Depends(get_db)):
    if not conn.execute("SELECT 1 FROM employee WHERE id = ?", (body.employee_id,)).fetchone():
        raise HTTPException(404, "employee not found")
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
    if body.employee_id is not None and not conn.execute("SELECT 1 FROM employee WHERE id = ?", (body.employee_id,)).fetchone():
        raise HTTPException(404, "employee not found")
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
