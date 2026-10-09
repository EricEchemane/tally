"""Question picker and answering (SPEC §6). Fake mode picks by keywords; the real model is in an ollama test."""
import time

import pytest

from llm.question_picker import Pick, _clean, pick_by_keywords
from questions import templates

CASES = [  # (question, expected Pick) — English, Filipino and Taglish
    ("How much input VAT did we lose this month, and why?", Pick(2, period="THIS_MONTH")),
    ("Magkano ang ibabalik ni Juan?", Pick(3, employee="Juan")),
    ("How much does Maria Santos still have to return?", Pick(3, employee="Maria Santos")),
    ("Magkano ang nagastos sa pagkain noong Abril?", Pick(4, expense_category="MEALS", period="MONTH:04")),
    ("How much did we spend on fuel last month?", Pick(4, expense_category="TRANSPORT_FUEL", period="LAST_MONTH")),
    ("Which cash advances are still open after 45 days?", Pick(1, days=45)),
    ("Which suppliers gave us the most invalid receipts?", Pick(5)),
    ("May resibo bang dalawang beses na-submit?", Pick(6)),
    ("Ano pa ang kailangan kong i-review?", Pick(7)),
    ("What's the weather tomorrow?", Pick(0)),
]


@pytest.mark.parametrize("text,expected", CASES)
def test_keyword_picker(text, expected):
    assert pick_by_keywords(text) == expected


def test_llm_output_is_validated():
    p = _clean({"question_id": 9, "employee": "  ", "expense_category": "FOOD", "period": "2026-04", "days": -3})
    assert p == Pick(0)
    assert _clean({"question_id": 4, "employee": None, "expense_category": "MEALS", "period": "MONTH:04", "days": None}) \
        == Pick(4, expense_category="MEALS", period="MONTH:04")


def _ask(c, text):
    qid = c.post("/api/questions", json={"text": text}).json()["question_id"]
    deadline = time.monotonic() + 5
    while (q := c.get(f"/api/questions/{qid}").json())["state"] != "done":
        assert time.monotonic() < deadline
        time.sleep(0.02)
    return q["answer"]


@pytest.fixture
def recorded(monkeypatch):
    """Stand-in for Simon's templates: records the slots it was called with."""
    calls = []

    def run(conn, question_id, slots, today):
        calls.append((question_id, slots, today))
        return {"kind": "answer", "sentence": "ok", "table": {"columns": [], "rows": []}, "links": [],
                "how": {"question_id": question_id, "question": templates.SUPPORTED[question_id], "period": None}}

    monkeypatch.setattr(templates, "run", run)
    monkeypatch.setenv("TALLY_TODAY", "2026-10-09")
    return calls


def test_slots_reach_the_templates(clean_client, recorded):
    assert _ask(clean_client, "Magkano ang nagastos sa pagkain noong Abril?")["kind"] == "answer"
    qid, slots, today = recorded[-1]
    assert qid == 4 and slots["expense_category"] == "MEALS" and slots["period"] == "MONTH:04"
    assert str(today) == "2026-10-09"


def test_employee_is_resolved_or_clarified(clean_client, recorded):
    c = clean_client
    _ask(c, "Magkano ang ibabalik ni Juan?")
    assert recorded[-1][1]["employee_name"] == "Juan Dela Cruz"           # unique first-name match
    c.post("/api/employees", json={"name": "Juan Santos"})
    a = _ask(c, "Magkano ang ibabalik ni Juan?")
    assert a["kind"] == "clarify" and [ch["label"] for ch in a["choices"]] == ["Juan Dela Cruz", "Juan Santos"]
    assert a["choices"][1]["text"] == "Magkano ang ibabalik ni Juan Santos?"
    _ask(c, a["choices"][1]["text"])                                      # re-asking the choice resolves it
    assert recorded[-1][1]["employee_name"] == "Juan Santos"
    a = _ask(c, "How much does Pedro still have to return?")
    assert a["kind"] == "clarify" and "couldn't find" in a["sentence"]
    _ask(c, "Who still has to return money?")                             # no name: everyone
    assert recorded[-1][1]["employee_id"] is None


def test_unsupported_and_placeholder_until_templates_exist(clean_client):
    c = clean_client
    a = _ask(c, "What's the weather tomorrow?")
    assert a["kind"] == "unsupported" and len(a["supported"]) == 7
    a = _ask(c, "Ano pa ang kailangan kong i-review?")      # templates not written yet (Simon)
    assert a["kind"] == "answer" and a["how"]["question_id"] == 7 and "Simon" in a["sentence"]


# Phrasings outside the prompt's examples; only the real model is expected to get these.
UNSEEN = [
    ("Which cash advances are still unliquidated?", Pick(1)),
    ("Ilan ang resibong na-reject ngayong buwan dahil sa VAT?", Pick(2, period="THIS_MONTH")),
    ("Sino ang may utang pa sa company?", Pick(3)),
    ("Show me duplicate receipts from April", Pick(6, period="MONTH:04")),
    ("Magkano ang nagastos sa gasolina ngayong buwan?", Pick(4, expense_category="TRANSPORT_FUEL", period="THIS_MONTH")),
    ("Anong mga resibo ang kailangan pang i-check?", Pick(7)),
]


@pytest.mark.ollama
def test_real_model_picks_correctly(monkeypatch):
    """Run on the Mac: uv run pytest -m ollama tests/test_questions.py (measured 16/16, ~2–3 s each)."""
    import config
    from llm.question_picker import pick
    monkeypatch.setattr(config, "FAKE_PIPELINE", False)
    wrong = [(t, got, want) for t, want in CASES + UNSEEN if (got := pick(t)) != want]
    assert not wrong, wrong
