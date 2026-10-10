import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import get_db
from llm.question_picker import MAX_TEXT, clean_text
from pipeline import runner
from questions import replies

router = APIRouter(prefix="/api/questions")
MAX_WAITING = 5  # questions run ahead of receipts; a flood of them must not stall receipt reading


class QuestionIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT)


def _row(q: sqlite3.Row) -> dict:
    return {"id": q["id"], "text": q["text"], "state": q["state"], "created_at": q["created_at"],
            "answer": json.loads(q["answer"]) if q["answer"] else None}


@router.post("", status_code=202)
def ask(body: QuestionIn, conn: sqlite3.Connection = Depends(get_db)):
    text = clean_text(body.text)
    if not text:
        raise HTTPException(422, "Type a question")
    waiting = conn.execute("SELECT COUNT(*) FROM question WHERE state != 'done'").fetchone()[0]
    if waiting >= MAX_WAITING:
        raise HTTPException(429, "Tally is still answering your earlier questions. Try again in a moment.")
    qid = conn.execute("INSERT INTO question (text) VALUES (?)", (text,)).lastrowid
    conn.commit()
    runner.enqueue_question(qid)
    return {"question_id": qid}


@router.get("/intro")
def intro(lang: str = "en"):
    """Tally's introduction for the empty Ask Tally panel: the same pre-written text a greeting gets."""
    return replies.intro("fil" if lang == "fil" else "en")


@router.get("")
def history(conn: sqlite3.Connection = Depends(get_db)):
    return [_row(q) for q in conn.execute("SELECT * FROM question ORDER BY id DESC LIMIT 50")]


@router.get("/{question_id}")
def get(question_id: int, conn: sqlite3.Connection = Depends(get_db)):
    q = conn.execute("SELECT * FROM question WHERE id = ?", (question_id,)).fetchone()
    if not q:
        raise HTTPException(404, "question not found")
    return _row(q)
