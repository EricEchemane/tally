"""SQLite access. One connection per request; schema applied on startup (SPEC §3)."""
import sqlite3
from pathlib import Path

import config

SCHEMA = Path(__file__).with_name("schema.sql")


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Columns added after the first schema; CREATE TABLE IF NOT EXISTS won't add them to an existing DB.
_ADDED_COLUMNS = [("receipt", "checks_run", "INTEGER NOT NULL DEFAULT 0"),
                  ("employee", "active", "INTEGER NOT NULL DEFAULT 1"),
                  ("cash_advance", "archived_at", "TEXT"),
                  ("receipt", "cropped_path", "TEXT"),
                  ("receipt", "crop_corners", "TEXT")]


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    for table, column, decl in _ADDED_COLUMNS:
        if column not in {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
    conn.commit()


def get_db():
    """FastAPI dependency."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
