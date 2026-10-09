"""Question picker (SPEC §6): the LLM only says WHICH of the 7 questions was asked and fills slots.

Code resolves dates, runs fixed SQL and writes the answer; no number comes from the model.
Fake pipeline mode uses keyword matching instead of the model (SPEC §2).
"""
import re
from dataclasses import dataclass

import config
from llm.client import chat_json
from llm.extraction import EXPENSE_CATEGORIES

PERIOD = re.compile(r"^(THIS_MONTH|LAST_MONTH|THIS_QUARTER|LAST_QUARTER|THIS_YEAR|MONTH:(\d{4}-)?\d{2}"
                    r"|RANGE:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2})$")


@dataclass(frozen=True)
class Pick:
    question_id: int                 # 0 = not one of the supported questions
    employee: str | None = None      # name as the user wrote it; resolved to an Employee in code
    expense_category: str | None = None
    period: str | None = None        # one of PERIOD; resolved to dates in code
    days: int | None = None


SCHEMA = {
    "type": "object",
    "properties": {
        "question_id": {"type": "integer", "enum": [0, 1, 2, 3, 4, 5, 6, 7]},
        "employee": {"type": ["string", "null"]},
        "expense_category": {"type": ["string", "null"], "enum": EXPENSE_CATEGORIES + [None]},
        "period": {"type": ["string", "null"]},
        "days": {"type": ["integer", "null"]},
    },
    "required": ["question_id", "employee", "expense_category", "period", "days"],
}

SYSTEM = """You route a finance Reviewer's question (English, Filipino or Taglish) to ONE supported question and fill its slots as JSON.

Supported questions:
1 = Open (unliquidated, hindi pa na-liquidate) cash advances older than N days. Slot: days (default null).
2 = Input VAT lost in a period, and why: rejected or non-claimable VAT, receipts rejected because of VAT (nawalang VAT, na-reject dahil sa VAT). Slot: period.
3 = How much an employee must return / still owes the company (ibabalik, isasauli, utang, may utang pa). Slot: employee (null = everyone).
4 = Spending by expense category in a period (gastos, nagastos). Slots: expense_category (null = all categories), period.
5 = Suppliers with the most invalid/rejected receipts (tindahan, supplier). Slot: period (optional).
6 = Receipts submitted twice (duplicates, doble, dalawang beses). Slot: period (optional).
7 = What still needs my review (receipts needing review, i-review, i-check).
0 = anything else.

Slot rules:
- employee: the person's name exactly as written ("Juan", "Maria Santos"); never invent one.
- expense_category: MEALS (food, pagkain), TRANSPORT_FUEL (fuel, gas, pamasahe, toll), LODGING (hotel), SUPPLIES (supplies, gamit), OTHER.
- period: THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER, THIS_YEAR, or MONTH:MM for a named month (April / Abril = MONTH:04). Use null if no time is mentioned. Never compute dates.
- days: a number of days only if one is mentioned.

Examples:
"How much input VAT did we lose this month, and why?" -> {"question_id": 2, "employee": null, "expense_category": null, "period": "THIS_MONTH", "days": null}
"Ilan ang resibong na-reject dahil sa VAT noong Mayo?" -> {"question_id": 2, "employee": null, "expense_category": null, "period": "MONTH:05", "days": null}
"Magkano ang ibabalik ni Juan?" -> {"question_id": 3, "employee": "Juan", "expense_category": null, "period": null, "days": null}
"Magkano ang nagastos sa pagkain noong Abril?" -> {"question_id": 4, "employee": null, "expense_category": "MEALS", "period": "MONTH:04", "days": null}
"Which cash advances are still open after 45 days?" -> {"question_id": 1, "employee": null, "expense_category": null, "period": null, "days": 45}
"May resibo bang dalawang beses na-submit?" -> {"question_id": 6, "employee": null, "expense_category": null, "period": null, "days": null}
"Ano pa ang kailangan kong i-review?" -> {"question_id": 7, "employee": null, "expense_category": null, "period": null, "days": null}
"What's the weather tomorrow?" -> {"question_id": 0, "employee": null, "expense_category": null, "period": null, "days": null}"""


def _clean(raw: dict) -> Pick:
    qid = raw.get("question_id") if raw.get("question_id") in range(8) else 0
    period = raw.get("period")
    category = raw.get("expense_category")
    days = raw.get("days")
    employee = (raw.get("employee") or "").strip() or None
    return Pick(
        question_id=qid,
        employee=employee,
        expense_category=category if category in EXPENSE_CATEGORIES else None,
        period=period if isinstance(period, str) and PERIOD.match(period) else None,
        days=days if isinstance(days, int) and 0 < days < 3650 else None,
    )


def pick(text: str) -> Pick:
    if config.FAKE_PIPELINE:
        return pick_by_keywords(text)
    return _clean(chat_json(SYSTEM, f'"{text}" ->', SCHEMA, num_predict=80))


# ---------- fake mode: keyword matching (no model) ----------

_MONTH_WORDS = [
    ("january|jan|enero", 1), ("february|feb|pebrero", 2), ("march|mar|marso", 3), ("april|apr|abril", 4),
    ("(?:in|noong|during|of|last|this) may|mayo", 5), ("june|jun|hunyo", 6), ("july|jul|hulyo", 7),
    ("august|aug|agosto", 8), ("september|sept|sep|setyembre", 9), ("october|oct|oktubre", 10),
    ("november|nov|nobyembre", 11), ("december|dec|disyembre", 12),
]


def _month(t: str) -> int | None:
    for words, n in _MONTH_WORDS:
        if re.search(rf"\b(?:{words})\b", t):
            return n
    return None


_CATEGORY_WORDS = [("MEALS", r"meal|food|pagkain|kain|restaurant"), ("TRANSPORT_FUEL", r"fuel|gas\b|pamasahe|toll|transport"),
                   ("LODGING", r"hotel|lodging"), ("SUPPLIES", r"suppl|gamit")]


def pick_by_keywords(text: str) -> Pick:
    t = text.lower()
    period = ("THIS_MONTH" if re.search(r"this month|ngayong buwan", t) else
              "LAST_MONTH" if re.search(r"last month|nakaraang buwan", t) else
              "THIS_QUARTER" if "this quarter" in t else None)
    if not period and (month := _month(t)):
        period = f"MONTH:{month:02d}"
    days = int(d.group(1)) if (d := re.search(r"(\d+)\s*(days|araw)", t)) else None
    category = next((c for c, rx in _CATEGORY_WORDS if re.search(rx, t)), None)
    who = re.search(r"\bni\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)|\bdoes\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)\s+(?:still\s+)?(?:have|owe|need)", text)
    employee = (who.group(1) or who.group(2)) if who else None
    if re.search(r"twice|duplicate|dalawang beses|doble", t):
        qid = 6
    elif re.search(r"review|i-review", t):
        qid = 7
    elif re.search(r"\bvat\b", t):
        qid = 2
    elif re.search(r"return|ibabalik|isasauli|owe|utang", t):
        qid = 3
    elif re.search(r"supplier|seller|tindahan", t):
        qid = 5
    elif re.search(r"open|unliquidated|hindi pa", t):
        qid = 1
    elif re.search(r"spen[dt]|gastos|nagastos|gastos", t):
        qid = 4
    else:
        qid = 0
    return Pick(qid, employee, category if qid == 4 else None, period, days)
