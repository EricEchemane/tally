"""Liquidation totals in centavos (SPEC §5). The UI never computes these."""
from dataclasses import dataclass


@dataclass
class ReceiptMoney:
    status: str | None        # None while still processing
    total: int | None         # effective total, centavos
    vat: int | None           # effective VAT amount, centavos


def liquidation_totals(advance: int, receipts: list[ReceiptMoney]) -> dict[str, int]:
    done = [r for r in receipts if r.status is not None and r.total is not None]
    valid = sum(r.total for r in done if r.status != "REJECT")
    disallowed = sum(r.total for r in done if r.status == "REJECT")
    claimable_vat = sum(r.vat or 0 for r in done if r.status == "ACCEPTED")
    return {
        "advance": advance,
        "valid_spend": valid,
        "disallowed": disallowed,
        "amount_to_return": max(advance - valid, 0),
        "excess_spend": max(valid - advance, 0),
        "claimable_input_vat": claimable_vat,
    }
