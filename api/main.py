"""Tally API. Run: uv run uvicorn main:app --reload  (SPEC §2, §7)."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

import db
import events
from checks import service as checks
from db.seed import seed
from pipeline import runner
from routes import company, exports, liquidations, ops, people, questions, receipts, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = db.connect()
    db.init_db(conn)
    seed(conn)
    checks.recheck_open(conn, publish=False)  # rule or code changes since the last run
    conn.close()
    events.bind_loop(asyncio.get_running_loop())
    runner.start()
    yield
    await runner.stop()


app = FastAPI(title="Tally API", lifespan=lifespan)
for r in (ops, company, people, liquidations, receipts, questions, exports, ws):
    app.include_router(r.router)
