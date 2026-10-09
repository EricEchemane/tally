"""Answer a stored question (SPEC §6). Runs on the LLM worker at priority 0, ahead of receipts.

Hours 10–12 (Eric): the LLM question picker -> questions.templates.run (Simon). Until then it
answers "unsupported" with the list of questions Tally will answer.
"""
import json
import sqlite3

from questions.templates import SUPPORTED


async def answer(conn: sqlite3.Connection, question_id: int) -> dict:
    row = conn.execute("SELECT text FROM question WHERE id = ?", (question_id,)).fetchone()
    if row is None:
        return {}
    conn.execute("UPDATE question SET state = 'answering' WHERE id = ?", (question_id,))
    conn.commit()
    result = {"kind": "unsupported",
              "sentence": "Questions aren't wired up yet. These are the questions Tally will answer:",
              "supported": list(SUPPORTED.values())}
    conn.execute("UPDATE question SET state = 'done', answer = ? WHERE id = ?", (json.dumps(result), question_id))
    conn.commit()
    return result
