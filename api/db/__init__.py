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


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA.read_text())
    conn.commit()


def get_db():
    """FastAPI dependency."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
