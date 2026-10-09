"""Receipt extraction: the LLM copies values as printed; code decides everything else (SPEC §4)."""
from llm.client import chat_json

EXPENSE_CATEGORIES = ["MEALS", "TRANSPORT_FUEL", "LODGING", "SUPPLIES", "OTHER"]

_str = {"type": ["string", "null"]}
_num = {"type": ["number", "null"]}

SCHEMA = {
    "type": "object",
    "properties": {
        "seller_name": _str,
        "seller_address": _str,
        "seller_tin_raw": {**_str, "description": "The SELLER's TIN exactly as printed, including the branch code"},
        "invoice_number_raw": _str,
        "date_raw": {**_str, "description": "The transaction date exactly as printed"},
        "buyer_name": _str,
        "buyer_tin_raw": _str,
        "buyer_address": _str,
        "vatable_sales": _num,
        "vat_amount": _num,
        "vat_exempt_sales": _num,
        "zero_rated_sales": _num,
        "total": _num,
        "particulars": {**_str, "description": "What was bought, at most 6 words, e.g. '2 rice meals' or 'Fuel, 2.92 L'"},
        "expense_category": {"type": ["string", "null"], "enum": EXPENSE_CATEGORIES + [None]},
    },
    "required": [
        "seller_name", "seller_address", "seller_tin_raw", "invoice_number_raw", "date_raw",
        "buyer_name", "buyer_tin_raw", "buyer_address", "vatable_sales", "vat_amount",
        "vat_exempt_sales", "zero_rated_sales", "total", "particulars", "expense_category",
    ],
}

SYSTEM = """You read the OCR text of one Philippine receipt and copy its values into JSON.
- The seller is the business at the TOP. Its TIN follows "VAT REG TIN", "VAT Registered TIN" or "NON VAT REG TIN".
- Ignore the POS/software provider block near the BOTTOM (accreditation, PTU, "Date Issued", "Valid Until"); its TIN is NOT the seller TIN. A "MIN" is a machine number, not a TIN.
- buyer_name / buyer_tin_raw / buyer_address: only if written on the Name / Sold To / TIN / Address lines. Blank lines mean null.
- date_raw: the transaction date exactly as printed, never an accreditation or permit date.
- Amounts are plain numbers without currency symbols or commas. total is the amount due. Use null when a value is not printed.
- expense_category: MEALS (food, drinks), TRANSPORT_FUEL (fuel, fares, tolls, parking), LODGING, SUPPLIES (goods, medicine, hardware, groceries), OTHER.
- Copy values exactly as printed; never invent or calculate values."""


def extract(ocr_text: str) -> dict:
    return chat_json(SYSTEM, "Receipt OCR text:\n\n" + ocr_text, SCHEMA)
