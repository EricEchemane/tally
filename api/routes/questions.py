import asyncio
import json
import sqlite3

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

import db
import events
from db import get_db
from questions.templates import SUPPORTED

router = APIRouter(prefix="/api/questions")


class QuestionIn(BaseModel):
    text: str = Field(min_length=1)


def _row(q: sqlite3.Row) -> dict:
    return {"id": q["id"], "text": q["text"], "state": q["state"], "created_at": q["created_at"],
            "answer": json.loads(q["answer"]) if q["answer"] else None}


async def _answer_stub(question_id: int) -> None:
    """Hour-0 stand-in. TODO(Eric, hours 10–12): LLM question picker -> questions.templates.run (Simon)."""
    await asyncio.sleep(1)
    answer = {"kind": "unsupported",
              "sentence": "Questions aren't wired up yet. These are the questions Tally will answer:",
              "supported": list(SUPPORTED.values())}
    conn = db.connect()
    try:
        conn.execute("UPDATE question SET state = 'done', answer = ? WHERE id = ?", (json.dumps(answer), question_id))
        conn.commit()
    finally:
        conn.close()
    events.publish("question.answered", question_id=question_id)


@router.post("", status_code=202)
def ask(body: QuestionIn, background: BackgroundTasks, conn: sqlite3.Connection = Depends(get_db)):
    qid = conn.execute("INSERT INTO question (text) VALUES (?)", (body.text.strip(),)).lastrowid
    conn.commit()
    background.add_task(_answer_stub, qid)
    return {"question_id": qid}


@router.get("")
def history(conn: sqlite3.Connection = Depends(get_db)):
    return [_row(q) for q in conn.execute("SELECT * FROM question ORDER BY id DESC LIMIT 50")]


@router.get("/{question_id}")
def get(question_id: int, conn: sqlite3.Connection = Depends(get_db)):
    q = conn.execute("SELECT * FROM question WHERE id = ?", (question_id,)).fetchone()
    if not q:
        raise HTTPException(404, "question not found")
    return _row(q)
