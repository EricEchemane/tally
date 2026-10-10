"""Answer a stored question (SPEC §6). Runs on the LLM worker at priority 0, ahead of receipts.

The LLM picks the question and slots (llm.question_picker); code resolves the Employee and calls the
fixed SQL templates (questions.templates, Simon). No number in an answer comes from the model.
"""
import asyncio
import json
import re
import sqlite3

import config
from llm.question_picker import Pick, pick
from questions import replies, templates
from questions.templates import SUPPORTED

NEEDS_EMPLOYEE = {3}  # question 3 takes an optional Employee


def _reply(conn: sqlite3.Connection, question_id: int, p: Pick) -> dict:
    """Anything that isn't a Supported Question gets a pre-written reply; nothing here comes from the model."""
    lang = p.language if p.language in ("en", "fil") else "en"
    if p.reply == "GREETING":
        first = conn.execute("SELECT 1 FROM question WHERE id < ? LIMIT 1", (question_id,)).fetchone() is None
        return replies.greeting(lang, first)
    if p.reply == "HELP":
        return replies.intro(lang)
    if p.reply == "THANKS":
        return replies.thanks(lang)
    if p.reply == "EXPLAIN" and p.topic:
        return replies.explain(p.topic, lang)
    return replies.off_topic(lang)


def resolve_employee(conn: sqlite3.Connection, name: str) -> list[sqlite3.Row]:
    """Every word the user typed must start a word of the Employee's name ("Juan" -> Juan Dela Cruz)."""
    words = [w for w in re.findall(r"[\w-]+", name.lower()) if w]
    out = []
    for e in conn.execute("SELECT id, name FROM employee ORDER BY name"):
        parts = re.findall(r"[\w-]+", e["name"].lower())
        if words and all(any(p.startswith(w) for p in parts) for w in words):
            out.append(e)
    return out


def _clarify(text: str, typed: str, choices: list[sqlite3.Row], found: bool) -> dict:
    def ask_for(full: str) -> str:
        replaced = re.sub(re.escape(typed), full, text, count=1, flags=re.I)
        return replaced if replaced != text else f"{text} ({full})"

    return {"kind": "clarify",
            "sentence": f'Which "{typed}" do you mean?' if found else f'I couldn\'t find an Employee named "{typed}". Did you mean:',
            "choices": [{"label": m["name"], "text": ask_for(m["name"])} for m in choices]}


def build_slots(conn: sqlite3.Connection, text: str, p: Pick) -> tuple[dict | None, dict | None]:
    """Returns (slots, clarify_answer)."""
    slots = {"employee_id": None, "employee_name": None, "expense_category": p.expense_category,
             "period": p.period, "days": p.days}
    if p.question_id in NEEDS_EMPLOYEE and p.employee:
        matches = resolve_employee(conn, p.employee)
        if len(matches) != 1:
            everyone = matches or list(conn.execute("SELECT id, name FROM employee ORDER BY name LIMIT 6"))
            return None, _clarify(text, p.employee, everyone, found=bool(matches))
        slots.update(employee_id=matches[0]["id"], employee_name=matches[0]["name"])
    return slots, None


async def answer(conn: sqlite3.Connection, question_id: int) -> dict:
    row = conn.execute("SELECT text FROM question WHERE id = ?", (question_id,)).fetchone()
    if row is None:
        return {}
    text = row["text"]
    conn.execute("UPDATE question SET state = 'answering' WHERE id = ?", (question_id,))
    conn.commit()

    p = await asyncio.to_thread(pick, text)
    if p.question_id == 0:
        result = _reply(conn, question_id, p)
    else:
        slots, result = build_slots(conn, text, p)
        if result is None:
            try:
                result = templates.run(conn, p.question_id, slots, config.today())
            except NotImplementedError:
                result = {"kind": "answer",
                          "sentence": f"Understood: \"{SUPPORTED[p.question_id]}\". The answer appears once the "
                                      "question templates are in (Simon, SPEC §9).",
                          "table": {"columns": [], "rows": []}, "links": []}
            result.setdefault("how", {"question_id": p.question_id, "question": SUPPORTED[p.question_id],
                                      "period": None, "slots": slots})
    conn.execute("UPDATE question SET state = 'done', answer = ? WHERE id = ?", (json.dumps(result), question_id))
    conn.commit()
    return result
