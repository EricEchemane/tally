"""Period slots -> dates (SPEC §6). The model names a period; code does the date arithmetic."""
import calendar
import datetime as dt
import re


def _month(year: int, month: int) -> tuple[dt.date, dt.date]:
    return dt.date(year, month, 1), dt.date(year, month, calendar.monthrange(year, month)[1])


def resolve_period(period: str | None, today: dt.date) -> tuple[dt.date, dt.date] | None:
    """THIS_MONTH | LAST_MONTH | THIS_QUARTER | MONTH:YYYY-MM | RANGE:a..b -> (from, to), inclusive.
    None means no period (all time). Anything else raises ValueError."""
    if period is None or period.strip() == "":
        return None
    p = period.strip().upper()
    if p == "THIS_MONTH":
        return _month(today.year, today.month)
    if p == "LAST_MONTH":
        last = today.replace(day=1) - dt.timedelta(days=1)
        return _month(last.year, last.month)
    if p == "THIS_QUARTER":
        first = 3 * ((today.month - 1) // 3) + 1
        return dt.date(today.year, first, 1), _month(today.year, first + 2)[1]
    if m := re.fullmatch(r"MONTH:(\d{4})-(\d{2})", p):
        year, month = int(m[1]), int(m[2])
        if not 1 <= month <= 12:
            raise ValueError(f"bad month in period {period!r}")
        return _month(year, month)
    if m := re.fullmatch(r"RANGE:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})", p):
        a, b = dt.date.fromisoformat(m[1]), dt.date.fromisoformat(m[2])
        if b < a:
            raise ValueError(f"period {period!r} ends before it starts")
        return a, b
    raise ValueError(f"unknown period {period!r}")


def describe(span: tuple[dt.date, dt.date] | None) -> str:
    """'in April 2026', 'from 2026-04-01 to 2026-05-15', or '' for all time."""
    if span is None:
        return ""
    a, b = span
    if a.day == 1 and b == _month(a.year, a.month)[1]:
        return f"in {a:%B %Y}"
    if a.day == 1 and a.month in (1, 4, 7, 10) and b == _month(a.year, a.month + 2)[1]:
        return f"in Q{(a.month - 1) // 3 + 1} {a.year}"
    return f"from {a.isoformat()} to {b.isoformat()}"
