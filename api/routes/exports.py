import datetime as dt
import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

import exports
from db import get_db
from routes.liquidations import load as load_liquidation

router = APIRouter(prefix="/api")


@router.get("/liquidations/{liquidation_id}/summary.xlsx")
def summary(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    load_liquidation(conn, liquidation_id)
    try:
        data = exports.summary_xlsx(conn, liquidation_id)
    except NotImplementedError as e:
        raise HTTPException(501, str(e))
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="liquidation-{liquidation_id}.xlsx"'})


@router.get("/liquidations/{liquidation_id}/summary")
def summary_preview(liquidation_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """The same content as summary.xlsx, as JSON for the in-app preview (dates ISO, money in pesos)."""
    load_liquidation(conn, liquidation_id)
    data = exports.summary_data(conn, liquidation_id)
    rows = [[v.isoformat() if isinstance(v, dt.date) else v for v in row] for row in data["rows"]]
    return {**data, "rows": rows, "money_columns": sorted(exports.SUMMARY_MONEY_COLUMNS),
            "header": [list(h) for h in data["header"]], "totals": [list(t) for t in data["totals"]]}


@router.get("/exports/slsp.csv")
def slsp(month: str = Query(..., pattern=r"^\d{4}-\d{2}$"), conn: sqlite3.Connection = Depends(get_db)):
    try:
        data = exports.slsp_csv(conn, month)
    except NotImplementedError as e:
        raise HTTPException(501, str(e))
    return Response(data, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="slsp-purchases-{month}.csv"'})
