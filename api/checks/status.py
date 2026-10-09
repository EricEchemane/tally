"""Receipt Status = worst open Finding (SPEC §5)."""
RANK = {"REJECT": 3, "NEEDS_REVIEW": 2, "NO_INPUT_VAT": 1}


def receipt_status(open_severities: list[str]) -> str:
    if not open_severities:
        return "ACCEPTED"
    return max(open_severities, key=RANK.__getitem__)
