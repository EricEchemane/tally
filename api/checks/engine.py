"""The six checks (SPEC §5) as a pure function over effective receipt values. Amounts in centavos.

Principle: auto-REJECT only on printed evidence; a missing or unreadable value is NEEDS_REVIEW.
`condition` is a stable key so a Reviewer's dismissal survives re-runs.
"""
import datetime as dt
import re
from dataclasses import dataclass

from pipeline.derive import duplicate_key, vat_arithmetic_ok

BUYER_DETAILS_MIN = 100_000  # ₱1,000.00, the legal minimum for AT_1000_AND_ABOVE


@dataclass(frozen=True)
class Finding:
    check: str          # DOC_TYPE | SELLER_TIN | BUYER_DETAILS | VAT_ARITHMETIC | DUPLICATE | DATE
    condition: str
    severity: str       # REJECT | NEEDS_REVIEW | NO_INPUT_VAT
    message: str
    amount_affected: int | None = None
    related_liquidation_id: int | None = None


@dataclass(frozen=True)
class Context:
    company_tin: str                # digits; the first 9 are compared
    buyer_details_rule: str         # ALL_RECEIPTS | AT_1000_AND_ABOVE
    released_on: str                # ISO, inclusive
    spending_end_on: str            # ISO, inclusive


@dataclass(frozen=True)
class OtherReceipt:
    id: int
    liquidation_id: int
    duplicate_key: str | None
    image_hash: str


def _peso(c: int | None) -> str:
    return "—" if c is None else f"₱{c / 100:,.2f}"


def _digits(v) -> str:
    return re.sub(r"\D", "", str(v or ""))


def run_checks(r: dict, receipt_id: int, image_hash: str, ctx: Context, others: list[OtherReceipt]) -> list[Finding]:
    total = r.get("total")
    out: list[Finding] = []
    add = out.append
    foreign = r.get("currency", "PHP") != "PHP" or r.get("doc_type") == "OTHER"

    # 1. Document type
    if r.get("doc_type") == "OFFICIAL_RECEIPT":
        add(Finding("DOC_TYPE", "official_receipt", "REJECT",
                    "Official Receipt: since the EOPT Act (2024) only an Invoice supports a purchase", total))
    elif foreign:
        add(Finding("DOC_TYPE", "foreign", "REJECT", "Not a Philippine invoice (no BIR invoice, non-peso amounts)", total))
    elif r.get("doc_type") is None:
        add(Finding("DOC_TYPE", "no_title", "NEEDS_REVIEW",
                    "No Invoice or Official Receipt title found: confirm the document type", total))
    if not foreign and r.get("doc_type") != "OFFICIAL_RECEIPT":
        if r.get("vat_registered") is False:
            add(Finding("DOC_TYPE", "non_vat", "NO_INPUT_VAT", "Non-VAT seller: no input VAT to claim", r.get("vat_amount")))
        elif r.get("not_valid_notice"):
            add(Finding("DOC_TYPE", "not_valid_notice", "NO_INPUT_VAT",
                        '"Not valid for claim of input tax" is printed on the receipt', r.get("vat_amount")))

    if foreign:  # already rejected; the PH-specific checks below would only add noise
        return out + _duplicate(r, receipt_id, image_hash, others, total) + _date(r, ctx, total)

    # 2. Seller TIN
    tin, branch = _digits(r.get("seller_tin")), _digits(r.get("seller_branch"))
    if len(tin) != 9:
        add(Finding("SELLER_TIN", "missing", "NEEDS_REVIEW", "Seller TIN not found or unreadable: confirm it", total))
    elif not 3 <= len(branch) <= 5:
        add(Finding("SELLER_TIN", "branch_missing", "NEEDS_REVIEW",
                    f"Seller TIN {tin[:3]}-{tin[3:6]}-{tin[6:]} has no complete branch code: confirm it", total))

    # 3. Buyer details (per the Company's Buyer Details Rule)
    applies = ctx.buyer_details_rule == "ALL_RECEIPTS" or (total or 0) >= BUYER_DETAILS_MIN
    if applies:
        buyer_tin = _digits(r.get("buyer_tin"))[:9]
        written = any((r.get(k) or "").strip() for k in ("buyer_name", "buyer_tin", "buyer_tin_raw"))
        rule = "required on all receipts" if ctx.buyer_details_rule == "ALL_RECEIPTS" else "required from ₱1,000"
        if len(buyer_tin) == 9 and buyer_tin != ctx.company_tin[:9]:
            add(Finding("BUYER_DETAILS", "tin_mismatch", "REJECT",
                        f"Buyer TIN {buyer_tin} is not the Company's TIN", total))
        elif len(buyer_tin) != 9 and not written:
            add(Finding("BUYER_DETAILS", "blank", "REJECT", f"No Company name/TIN on the receipt ({rule})", total))
        elif len(buyer_tin) != 9:
            add(Finding("BUYER_DETAILS", "unreadable", "NEEDS_REVIEW",
                        "Something is written on the buyer line but no Company TIN could be read", total))

    # 4. VAT arithmetic (VAT-registered sellers; ±₱0.05 after the auto-repair)
    if total is None:
        add(Finding("VAT_ARITHMETIC", "total_missing", "NEEDS_REVIEW", "Total not found: confirm the amount"))
    elif r.get("vat_registered"):
        if r.get("vatable_sales") is None and r.get("vat_amount") is None:
            add(Finding("VAT_ARITHMETIC", "no_breakdown", "NEEDS_REVIEW",
                        "No VAT breakdown found on a VAT-registered seller's receipt", total))
        elif not vat_arithmetic_ok(r):
            add(Finding("VAT_ARITHMETIC", "mismatch", "NEEDS_REVIEW",
                        f"Amounts don't add up (VATable {_peso(r.get('vatable_sales'))}, VAT {_peso(r.get('vat_amount'))}, "
                        f"total {_peso(total)}): likely misread, confirm them", total))

    return out + _duplicate(r, receipt_id, image_hash, others, total) + _date(r, ctx, total)


def _duplicate(r, receipt_id, image_hash, others, total) -> list[Finding]:
    """5. Duplicate: same seller TIN + branch + invoice number, or the identical image, in any Liquidation.
    Only the later receipt (higher id) is rejected, naming the earlier one's Liquidation."""
    key = duplicate_key(r)
    for o in sorted(others, key=lambda o: o.id):
        if o.id >= receipt_id:
            continue
        if (key and o.duplicate_key == key) or o.image_hash == image_hash:
            how = "same image" if o.image_hash == image_hash else "same seller and invoice number"
            return [Finding("DUPLICATE", "duplicate", "REJECT",
                            f"Already submitted ({how}) as receipt #{o.id} in Liquidation #{o.liquidation_id}",
                            total, o.liquidation_id)]
    return []


def _date(r, ctx: Context, total) -> list[Finding]:
    """6. Date within the Spending Period (inclusive, no grace)."""
    date = r.get("date")
    if not date:
        return [Finding("DATE", "missing", "NEEDS_REVIEW", "Receipt date not found: confirm it", total)]
    try:
        d = dt.date.fromisoformat(date)
    except ValueError:
        return [Finding("DATE", "missing", "NEEDS_REVIEW", f"Receipt date '{date}' is not a date: confirm it", total)]
    if not ctx.released_on <= d.isoformat() <= ctx.spending_end_on:
        return [Finding("DATE", "outside_period", "REJECT",
                        f"Dated {d.isoformat()}, outside the Spending Period {ctx.released_on} to {ctx.spending_end_on}",
                        total)]
    return []
