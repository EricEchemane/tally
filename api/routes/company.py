import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

import events
from checks import service as checks
from db import get_db

router = APIRouter(prefix="/api")


class CompanyPatch(BaseModel):
    buyer_details_rule: Literal["ALL_RECEIPTS", "AT_1000_AND_ABOVE"]


def _company(conn):
    c = conn.execute("SELECT name, tin, buyer_details_rule FROM company WHERE id = 1").fetchone()
    return dict(c)


@router.get("/company")
def get_company(conn: sqlite3.Connection = Depends(get_db)):
    return _company(conn)


@router.patch("/company")
def patch_company(body: CompanyPatch, conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("UPDATE company SET buyer_details_rule = ? WHERE id = 1", (body.buyer_details_rule,))
    conn.commit()
    events.publish("company.updated", buyer_details_rule=body.buyer_details_rule)
    checks.recheck_open(conn)  # the live-toggle demo moment: every OPEN Liquidation recomputes
    return _company(conn)
