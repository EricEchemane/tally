import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import events
from checks import service as checks
from db import get_db

router = APIRouter(prefix="/api")


class CompanyPatch(BaseModel):
    """Send only what changed: the top-bar toggle sends the rule alone; Settings may send all three."""
    buyer_details_rule: Literal["ALL_RECEIPTS", "AT_1000_AND_ABOVE"] | None = None
    name: str | None = Field(None, min_length=1, max_length=200)
    tin: str | None = None


def _company(conn):
    c = conn.execute("SELECT name, tin, buyer_details_rule FROM company WHERE id = 1").fetchone()
    return dict(c)


@router.get("/company")
def get_company(conn: sqlite3.Connection = Depends(get_db)):
    return _company(conn)


@router.patch("/company")
def patch_company(body: CompanyPatch, conn: sqlite3.Connection = Depends(get_db)):
    if body.tin is not None:
        tin = re.sub(r"\D", "", body.tin)
        if len(tin) not in (9, 12, 13, 14):
            raise HTTPException(422, "Enter the Company's TIN: 9 digits, plus the branch code if you have it")
        conn.execute("UPDATE company SET tin = ? WHERE id = 1", (tin,))
    if body.name is not None:
        conn.execute("UPDATE company SET name = ? WHERE id = 1", (body.name.strip(),))
    if body.buyer_details_rule is not None:
        conn.execute("UPDATE company SET buyer_details_rule = ? WHERE id = 1", (body.buyer_details_rule,))
    conn.commit()
    company = _company(conn)
    events.publish("company.updated", buyer_details_rule=company["buyer_details_rule"])
    checks.recheck_open(conn)  # the TIN and the rule feed the buyer-details check: every OPEN Liquidation recomputes
    return company
