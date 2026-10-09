import datetime as dt
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

import serialize
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
