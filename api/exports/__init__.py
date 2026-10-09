"""Exports (SPEC §7). Owner: Simon — hours 8–11.

Interfaces Eric's routes call. Read the DB through db.connect(); amounts in the DB are centavos.
"""
import sqlite3


def summary_xlsx(conn: sqlite3.Connection, liquidation_id: int) -> bytes:
    """Liquidation summary: TIN, date, seller name, seller address, particulars, amount,
    withholding tax, VAT, VAT-exempt + status, Findings and a totals block."""
    raise NotImplementedError("Simon: hours 8–11")


def slsp_csv(conn: sqlite3.Connection, month: str) -> str:
    """SLSP-ready purchases CSV for YYYY-MM; non-rejected receipts only. Columns in SPEC §7."""
    raise NotImplementedError("Simon: hours 8–11")
