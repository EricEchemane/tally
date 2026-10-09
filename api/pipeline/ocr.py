"""Apple Vision OCR with upright detection and row grouping (SPEC §4).

Ported from the M1 benchmark (.wayfinder/liquidation-review/research/03-m1-bench/ocr.py).
ocrmac is imported lazily so the app still starts on Windows (fake pipeline mode).
"""
import statistics
from dataclasses import dataclass

from PIL import Image

# Vision returns (text, confidence, (x, y, w, h)) with normalized coords, y from the bottom.
Observation = tuple[str, float, tuple[float, float, float, float]]


@dataclass
class OcrResult:
    text: str          # grouped rows, top to bottom, "  " between items on a row
    rotation: int      # degrees applied to make the image upright (0, 90 or -90)


def _recognize(img: Image.Image) -> list[Observation]:
    from ocrmac import ocrmac  # macOS only

    return ocrmac.OCR(img, recognition_level="accurate", language_preference=["en-US"]).recognize()


def is_sideways(obs: list[Observation]) -> bool:
    """Sideways text produces tall, narrow boxes."""
    return bool(obs) and statistics.median(o[2][3] / max(o[2][2], 1e-6) for o in obs) > 1.5


def to_rows(obs: list[Observation]) -> str:
    """Join observations whose vertical centres overlap into one printed row, left to right."""
    rows: list[dict] = []
    for text, _conf, (x, y, w, h) in sorted(obs, key=lambda o: -(o[2][1] + o[2][3] / 2)):
        cy = y + h / 2
        if rows and abs(rows[-1]["cy"] - cy) < 0.6 * min(h, rows[-1]["h"]):
            rows[-1]["items"].append((x, text))
            continue
        rows.append({"cy": cy, "h": h, "items": [(x, text)]})
    return "\n".join("  ".join(t for _, t in sorted(r["items"])) for r in rows)


def ocr_image(path: str) -> OcrResult:
    img = Image.open(path).convert("RGB")
    obs, rotation = _recognize(img), 0
    if is_sideways(obs):
        best = None
        for angle in (-90, 90):
            candidate = _recognize(img.rotate(angle, expand=True))
            score = sum(len(t) * c for t, c, _ in candidate)
            if best is None or score > best[0]:
                best = (score, candidate, angle)
        _, obs, rotation = best
    return OcrResult(text=to_rows(obs), rotation=rotation)
