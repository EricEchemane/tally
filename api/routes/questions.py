import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import get_db
from pipeline import runner

router = APIRouter(prefix="/api/questions")


class QuestionIn(BaseModel):
    text: str = Field(min_length=1)


def _row(q: sqlite3.Row) -> dict:
    return {"id": q["id"], "text": q["text"], "state": q["state"], "created_at": q["created_at"],
            "answer": json.loads(q["answer"]) if q["answer"] else None}


@router.post("", status_code=202)
def ask(body: QuestionIn, conn: sqlite3.Connection = Depends(get_db)):
    qid = conn.execute("INSERT INTO question (text) VALUES (?)", (body.text.strip(),)).lastrowid
    conn.commit()
    runner.enqueue_question(qid)
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
