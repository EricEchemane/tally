"""Derived layer: code decides what the LLM only read (SPEC §4). All amounts in centavos.

Rules ported from the M1 benchmark (post.py, repair.py) and the extraction-schema decisions.
"""
import datetime as dt
import itertools
import re

from money import to_centavos

AMOUNTS = ("vatable_sales", "vat_amount", "vat_exempt_sales", "zero_rated_sales", "total")
ARITH_TOLERANCE = 5   # centavos (±₱0.05), SPEC §5 check 4
REPAIR_TOLERANCE = 2  # centavos, when searching OCR numbers

# ---------- TINs ----------

def parse_tin(raw: str | None, ocr_text: str = "") -> tuple[str | None, str | None]:
    """'240-727-673-00006' -> ('240727673', '00006'). Rejects MIN-like numbers; rejoins a TIN
    whose branch digits wrapped onto the next OCR row (e.g. '624-464-614-00' / '0')."""
    if not raw:
        return None, None
    digits = re.sub(r"\D", "", raw)
    if 9 <= len(digits) < 12:
        digits += _wrapped_tail(raw, ocr_text)
    if 9 <= len(digits) <= 11:
        return digits[:9], None  # branch missing or incomplete -> NEEDS_REVIEW (check 2)
    if 12 <= len(digits) <= 14:
        return digits[:9], digits[9:]
    return None, None  # MINs (16–17 digits) and fragments are not TINs


def is_provider_tin(raw: str | None, ocr_text: str) -> bool:
    """True when the TIN sits in the bottom 40% of the receipt. PH receipts print the seller's TIN in
    the header; a TIN only legible near the bottom is the POS/software provider's (seen on faded
    Mercury Drug tapes, where OCR also mangles the provider labels, so keywords are not reliable)."""
    digits = re.sub(r"\D", "", raw or "")[:9]
    if len(digits) < 9:
        return False
    rows = ocr_text.splitlines()
    for i, row in enumerate(rows):
        if digits in re.sub(r"\D", "", row):
            return i >= len(rows) * 0.6
    return False


def _wrapped_tail(raw: str, ocr_text: str) -> str:
    rows = ocr_text.splitlines()
    for i, row in enumerate(rows[:-1]):
        if raw.strip() and raw.strip() in row and row.rstrip().endswith(raw.strip()):
            nxt = rows[i + 1].strip()
            if re.fullmatch(r"\d{1,2}", nxt):
                return nxt
    return ""


# ---------- dates ----------

_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%m-%d-%y", "%b %d, %Y", "%b %d %Y",
            "%d %b %Y", "%B %d, %Y", "%d %B %Y", "%Y/%m/%d", "%m.%d.%y", "%m.%d.%Y"]


_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
_DATE_TOKEN = re.compile(
    r"\d{4}-\d{2}-\d{2}|\d{4}/\d{1,2}/\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}"
    rf"|{_MONTH}\.? \d{{1,2}},? \d{{4}}|\d{{1,2}} {_MONTH}\.? \d{{4}}", re.I)


def parse_date(raw: str | None) -> str | None:
    """Accepts the formats seen on PH receipts; returns ISO or None. PH convention is month first."""
    if not raw:
        return None
    s = re.sub(r"\(.*?\)", " ", raw)
    s = re.sub(r"\b\d{1,2}:\d{2}(:\d{2})?\s*([AaPp]\.?[Mm]?\.?)?", " ", s)   # times
    s = re.sub(r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b,?", " ", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" ,.")
    m = _DATE_TOKEN.search(s)
    if m:
        s = m.group(0)
    for fmt in _FORMATS:
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


# ---------- invoice number ----------

_PREFIX = re.compile(
    r"^\s*(?:(?:SALES|SERVICE)\s+)?(?:INVOICE|S\.?\s?I\.?|[58]\.I\.|O\.?R\.?)?\s*(?:NO\.?|#|NUMBER)?\s*[:.]?\s*",
    re.I)


def parse_invoice_number(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = _PREFIX.sub("", raw.strip()).strip()
    return cleaned or None


_INVOICE_NO = r"((?:[A-Z]{1,4}-?)?[0-9][0-9-]{3,})"   # "175026", "059-00-000125989", "SI-000123"
_INVOICE_LABEL = re.compile(
    r"(?:SALES\s+INVOICE|SERVICE\s+INVOICE|INVOICE|\b[S58]\.?\s?I\.?|\bOR)\s*(?:NO\.?|NUMBER|#)\s*[:.]?\s*" + _INVOICE_NO
    + r"|\bINVOICE\s*#?\s*:?\s*([0-9][0-9-]{5,})",
    re.I)


def invoice_number_from_ocr(ocr: str) -> str | None:
    rows = ocr.splitlines()
    for i, row in enumerate(rows):
        m = _INVOICE_LABEL.search(row)
        if m:
            return (m.group(1) or m.group(2)).strip("-")
        # label alone on its row, number on the next ("SI No.:" / "1005702100043415")
        if re.search(r"(?:\bS\.?I\.?|INVOICE)\s*(?:NO\.?|#)\s*[:.]?\s*$", row, re.I) and i + 1 < len(rows):
            nxt = re.match(r"\s*" + _INVOICE_NO, rows[i + 1], re.I)
            if nxt:
                return nxt.group(1)
    return None


# ---------- document facts from the OCR text ----------

def doc_type(ocr: str, currency: str) -> str | None:
    up = re.sub(r"\s+", " ", ocr.upper())
    # "THIS IS NOT AN OFFICIAL RECEIPT" (printed on invoices and slips) is not evidence of one.
    if re.search(r"(?<!NOT AN )(?<!NOT A )OFFICIAL RECEIPT", up):
        return "OFFICIAL_RECEIPT"
    if currency != "PHP":
        return "OTHER"
    if re.search(r"INVOICE|INUBICE|INVO1CE|\bS\.?I\.?\s*(NO\b|#)", up):
        return "INVOICE"
    return None  # no title found -> NEEDS_REVIEW (check 1); never auto-OTHER on absence


def currency(ocr: str) -> str:
    up = ocr.upper()
    if re.search(r"PHP|₱|\bPESO", up):
        return "PHP"
    if re.search(r"\$\s?\d|\bUSD\b", up):
        return "USD"
    return "PHP"


def vat_registered(ocr: str, vat_amount: int | None) -> bool | None:
    up = ocr.upper()
    if re.search(r"NON[\s-]?VAT", up):
        return False
    if re.search(r"VAT\s*-?\s*REG|VATREG", up):
        return True
    return True if vat_amount else None


def not_valid_notice(ocr: str) -> bool:
    up = re.sub(r"\s+", " ", ocr.upper())
    return "NOT VALID FOR" in up and "INPUT TAX" in up


# ---------- VAT arithmetic and repair ----------

def vat_arithmetic_ok(d: dict) -> bool:
    """VATable × 12% = VAT and the parts sum to the total, within ±₱0.05 (SPEC §5 check 4)."""
    v, a, e, z, t = (d.get(k) or 0 for k in AMOUNTS)
    return abs(round(v * 0.12) - a) <= ARITH_TOLERANCE and abs(v + a + e + z - t) <= ARITH_TOLERANCE


def ocr_amounts(ocr: str) -> list[int]:
    found = re.findall(r"(?<![\d.])\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)", ocr)
    return sorted({to_centavos(m.replace(",", "")) for m in found})


def repair(d: dict, ocr: str) -> tuple[dict, bool]:
    """When the arithmetic fails, find OCR numbers that satisfy it. Prefer the LLM's total,
    then no exempt part, then the largest total."""
    if not d.get("vat_registered") or vat_arithmetic_ok(d):
        return d, False
    nums = ocr_amounts(ocr)
    cands = []
    for v, a in itertools.permutations(nums, 2):
        if v > 0 and abs(round(v * 0.12) - a) <= REPAIR_TOLERANCE:
            for t in nums:
                for e in [0] + nums:
                    if abs(v + a + e - t) <= REPAIR_TOLERANCE:
                        cands.append((t, v, a, e))
    if not cands:
        return d, False
    llm_total = d.get("total") or 0
    t, v, a, e = max(cands, key=lambda c: (abs(c[0] - llm_total) <= REPAIR_TOLERANCE, c[3] == 0, c[0]))
    return {**d, "vatable_sales": v, "vat_amount": a, "vat_exempt_sales": e, "zero_rated_sales": 0, "total": t}, True


# ---------- buyer details ----------

_BUYER_LABEL = re.compile(r"SOLD\s*TO|REGISTERED\s+NAME|CUST(OMER)?\.?\s*NAME|BUYER|^\s*NAME\s*[:.]", re.I)
_NOT_BUYER = re.compile(r"CASHIER|STAFF|SUKI|LOYALTY|CARD|SERVER|WAITER|PREPARED", re.I)


def credible_buyer_name(name: str | None, ocr: str) -> str | None:
    """Keep the LLM's buyer name only if it is written on a labelled buyer line of the OCR text.
    Drops masked loyalty names (EC*****N), cashier IDs, cardholder names and names seen in the
    photo background, which small models report as buyers."""
    name = (name or "").strip()
    if not name or "*" in name:
        return None
    token = re.sub(r"\s+", " ", name.split()[0]).upper()
    for row in ocr.splitlines():
        if _BUYER_LABEL.search(row) and not _NOT_BUYER.search(row) and token in row.upper():
            return name
    return None


# ---------- SLSP bucket ----------

_FUEL = re.compile(r"\b(FUEL|GAS(OLINE)?|DIESEL|UNLEADED|PETRON|SHELL|CALTEX|SEAOIL|PHOENIX|\d+(\.\d+)?\s?L)\b", re.I)


def slsp_bucket(category: str | None, particulars: str | None, seller: str | None) -> str:
    if category == "TRANSPORT_FUEL":
        return "OTHER_GOODS" if _FUEL.search(f"{particulars or ''} {seller or ''}") else "SERVICES"
    if category in ("MEALS", "LODGING"):
        return "SERVICES"
    return "OTHER_GOODS"


# ---------- the derived layer ----------

def derive(extraction: dict, ocr: str) -> dict:
    cur = currency(ocr)
    d = {k: to_centavos(extraction.get(k)) for k in AMOUNTS}
    seller_raw = extraction.get("seller_tin_raw")
    if is_provider_tin(seller_raw, ocr):
        seller_raw = None  # the POS provider's TIN, not the seller's -> NEEDS_REVIEW
    seller_tin, seller_branch = parse_tin(seller_raw, ocr)
    buyer_tin, buyer_branch = parse_tin(extraction.get("buyer_tin_raw"), ocr)
    d.update(
        seller_name=extraction.get("seller_name"),
        seller_address=extraction.get("seller_address"),
        seller_tin=seller_tin,
        seller_branch=seller_branch,
        invoice_number=(invoice_number_from_ocr(ocr) if cur == "PHP" else None)
        or parse_invoice_number(extraction.get("invoice_number_raw")),
        date=parse_date(extraction.get("date_raw")),
        buyer_name=credible_buyer_name(extraction.get("buyer_name"), ocr),
        buyer_tin=buyer_tin,
        buyer_tin_raw=extraction.get("buyer_tin_raw") if re.search(r"\d{3}", extraction.get("buyer_tin_raw") or "") else None,
        buyer_address=extraction.get("buyer_address"),
        particulars=extraction.get("particulars"),
        expense_category=extraction.get("expense_category"),
        currency=cur,
        doc_type=doc_type(ocr, cur),
        not_valid_notice=not_valid_notice(ocr),
        withholding_tax=None,
    )
    d["vat_registered"] = vat_registered(ocr, d["vat_amount"])
    if d["vat_registered"] is False:  # Non-VAT sellers have no VATable sales or VAT
        d["vatable_sales"], d["vat_amount"] = None, None
    d, d["amounts_repaired"] = repair(d, ocr)
    d["slsp_bucket"] = slsp_bucket(d["expense_category"], d["particulars"], d["seller_name"])
    d["duplicate_key"] = duplicate_key(d)
    return d


def duplicate_key(d: dict) -> str | None:
    """Seller TIN + branch + invoice number. BIR invoice serials are unique per seller branch; the total
    is left out because OCR misreads it (the blurry 7-Eleven duplicate read ₱284 as ₱1,000)."""
    tin, inv = d.get("seller_tin"), d.get("invoice_number")
    if not tin or not inv:
        return None
    return f"{tin}|{d.get('seller_branch') or ''}|{re.sub(r'[^0-9A-Za-z]', '', inv)}"
