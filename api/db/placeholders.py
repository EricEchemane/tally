"""Hour-0 placeholder receipts so the UI has realistic data before the pipeline exists.

Hand-written to match SPEC §4 (extraction/derived shapes) and §5 (Findings). Uses real sample
images and their committed OCR text. Replaced by the real demo seed at hours 12–14 (SPEC §9).
Disable with TALLY_SEED_PLACEHOLDERS=0.
"""
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SAMPLES = REPO / "samples" / "receipts"
OCR = REPO / ".wayfinder" / "liquidation-review" / "research" / "03-m1-bench" / "ocr"


def _derived(**kw):
    base = {
        "seller_name": None, "seller_address": None, "seller_tin": None, "seller_branch": None,
        "invoice_number": None, "date": None, "buyer_name": None, "buyer_tin": None, "buyer_address": None,
        "vatable_sales": None, "vat_amount": None, "vat_exempt_sales": 0, "zero_rated_sales": 0, "total": None,
        "particulars": None, "expense_category": None, "doc_type": "INVOICE", "vat_registered": True,
        "not_valid_notice": False, "currency": "PHP", "slsp_bucket": None, "amounts_repaired": False,
        "duplicate_key": None, "withholding_tax": None,
    }
    base.update(kw)
    if base["seller_tin"] and base["invoice_number"] and base["total"] is not None:
        base["duplicate_key"] = f"{base['seller_tin']}|{base['invoice_number']}|{base['total']}"
    return base


BUYER_BLANK = ("BUYER_DETAILS", "blank", "REJECT",
               "No Company name/TIN on the receipt (required on all receipts)")

PLACEHOLDERS = [
    {   # REJECT: clean VAT invoice, but no buyer details under ALL_RECEIPTS
        "sample": "valid-bf-sinangag",
        "extraction": {"seller_name": "BF SINANGAG EXPRESS FOOD CORP", "seller_tin_raw": "240-727-673-00006",
                       "invoice_number_raw": "175026", "date_raw": "Fri 3 Apr 2026", "total": 355.0},
        "derived": _derived(seller_name="BF Sinangag Express Food Corp",
                            seller_address="Unit 106 A&C Northgate Cyberzone, Alabang, Muntinlupa",
                            seller_tin="240727673", seller_branch="00006", invoice_number="175026",
                            date="2026-04-03", vatable_sales=31696, vat_amount=3804, total=35500,
                            particulars="2 rice meals", expense_category="MEALS", slsp_bucket="SERVICES"),
        "findings": [BUYER_BLANK],
        "status": "REJECT",
    },
    {   # NEEDS_REVIEW: OCR missed the "SALES INVOICE" title; something written on the buyer line
        "sample": "valid-petron-fuel",
        "extraction": {"seller_name": "Primera Clase Gas Station, Inc.", "seller_tin_raw": "007-851-409-0000",
                       "invoice_number_raw": "0001362299", "date_raw": "04/03/2026", "buyer_name": "23",
                       "total": 282.95},
        "derived": _derived(seller_name="Primera Clase Gas Station, Inc.",
                            seller_address="Pacific Rim cor. Commerce Ave., Filinvest, Alabang, Muntinlupa",
                            seller_tin="007851409", seller_branch="0000", invoice_number="0001362299",
                            date="2026-04-03", buyer_name="23", vatable_sales=25263, vat_amount=3032, total=28295,
                            particulars="Fuel, 2.92 L", expense_category="TRANSPORT_FUEL", slsp_bucket="OTHER_GOODS",
                            doc_type=None, amounts_repaired=True),
        "findings": [("DOC_TYPE", "no_title", "NEEDS_REVIEW",
                      "No Invoice or Official Receipt title found: confirm the document type"),
                     ("BUYER_DETAILS", "unreadable", "NEEDS_REVIEW",
                      "Something is written on the buyer line but no Company TIN could be read")],
        "status": "NEEDS_REVIEW",
    },
    {   # REJECT + NO_INPUT_VAT: Non-VAT seller with the "not valid for input tax" notice
        "sample": "nonvat-mouthfeel",
        "extraction": {"seller_name": "MOUTHFEEL COMPANY", "seller_tin_raw": "624-464-614-00",
                       "invoice_number_raw": "064950", "date_raw": "3:14pm, Tue 31 Mar 2026", "total": 260.0},
        "derived": _derived(seller_name="Mouthfeel Company",
                            seller_address="Ground Floor Avida Tower, Alabang-Zapote Road, Muntinlupa",
                            seller_tin="624464614", seller_branch="000", invoice_number="064950",
                            date="2026-03-31", total=26000, vat_registered=False, not_valid_notice=True,
                            vat_exempt_sales=0, particulars="2 iced coffees", expense_category="MEALS",
                            slsp_bucket="SERVICES"),
        "findings": [("DOC_TYPE", "non_vat", "NO_INPUT_VAT", "Non-VAT seller: no input VAT to claim"), BUYER_BLANK],
        "status": "REJECT",
    },
    {   # ACCEPTED: buyer Finding dismissed with a reason
        "sample": "valid-llaollao-service-invoice",
        "extraction": {"seller_name": "llaollao", "seller_tin_raw": "009-229-593-00012",
                       "invoice_number_raw": "SI #: 00002431", "date_raw": "Apr 12, 2026 05:12 PM", "total": 159.0},
        "derived": _derived(seller_name="llaollao (Festival Mall)",
                            seller_address="K231.1 Festival Mall, Alabang, Muntinlupa",
                            seller_tin="009229593", seller_branch="00012", invoice_number="00002431",
                            date="2026-04-12", vatable_sales=14196, vat_amount=1704, total=15900,
                            particulars="Frozen yogurt tub", expense_category="MEALS", slsp_bucket="SERVICES",
                            amounts_repaired=True),
        "findings": [BUYER_BLANK + ("DISMISSED", "Client entertainment approved by finance head; kiosk can't print buyer details")],
        "status": "ACCEPTED",
    },
]


def insert(conn, liquidation_id: int) -> None:
    for p in PLACEHOLDERS:
        image = next(SAMPLES.glob(p["sample"] + ".*"), None)
        if image is None:
            continue
        ocr_file = OCR / f"{p['sample']}.txt"
        rid = conn.execute(
            "INSERT INTO receipt (liquidation_id, stage, image_path, image_hash, ocr_text, extraction, derived, status, checks_run) "
            "VALUES (?, 'done', ?, ?, ?, ?, ?, ?, 1)",
            (liquidation_id, str(image), hashlib.sha256(image.read_bytes()).hexdigest(),
             ocr_file.read_text() if ocr_file.exists() else None,
             json.dumps(p["extraction"]), json.dumps(p["derived"]), p["status"])).lastrowid
        for f in p["findings"]:
            check, condition, severity, message, *dismissed = f
            amount = p["derived"]["total"] if severity == "REJECT" else (
                p["derived"]["vat_amount"] if severity == "NO_INPUT_VAT" else None)
            conn.execute(
                'INSERT INTO finding (receipt_id, "check", condition, severity, state, message, amount_affected, dismissal_reason) '
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (rid, check, condition, severity, dismissed[0] if dismissed else "OPEN", message, amount,
                 dismissed[1] if dismissed else None))
