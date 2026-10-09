"""Money is stored as integer centavos; the API speaks peso numbers with 2 decimals (SPEC §3)."""
from decimal import Decimal, ROUND_HALF_UP


def to_centavos(pesos: float | int | str | Decimal | None) -> int | None:
    if pesos is None:
        return None
    return int((Decimal(str(pesos)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_pesos(centavos: int | None) -> float | None:
    if centavos is None:
        return None
    return float(Decimal(centavos) / 100)
