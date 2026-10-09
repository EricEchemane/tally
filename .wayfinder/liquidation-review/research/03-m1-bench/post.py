"""Code post-processing the product would do after the LLM: normalize formats, decide doc facts by keyword."""
import re, datetime
FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%d %b %Y", "%a %d %b %Y", "%Y/%m/%d", "%d/%m/%Y"]
def norm_date(s):
    if not s: return None
    s = re.sub(r"\(.*?\)|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b,?", "", s).strip(" ,")
    for f in FORMATS:
        try: return datetime.datetime.strptime(s, f).date().isoformat()
        except ValueError: pass
    return s
def post(pred, ocr):
    p = dict(pred); up = ocr.upper()
    p["date"] = norm_date(p.get("date"))
    p["invoice_number"] = re.sub(r"^\s*(S\.?I\.?|OR|INVOICE|NO)\.?\s*(#|NO\.?)?\s*:?\s*", "", p.get("invoice_number") or "", flags=re.I) or None
    if "OFFICIAL RECEIPT" in up: p["doc_type"] = "OFFICIAL_RECEIPT"
    elif "INVOICE" in up or "INUBICE" in up: p["doc_type"] = "INVOICE"
    elif p.get("currency") != "PHP" or not p.get("seller_tin"): p["doc_type"] = "OTHER"
    p["not_valid_for_input_tax_notice"] = "NOT VALID FOR" in up and "INPUT TAX" in up
    if re.search(r"NON[\s-]?VAT", up): p["vat_registered"] = False
    elif re.search(r"VAT\s*-?\s*REG", up): p["vat_registered"] = True
    # otherwise keep the LLM's reading
    if p.get("vat_registered") is False:  # Non-VAT sellers have no VATable sales or VAT
        p["vatable_sales"], p["vat_amount"] = None, None
    return p
