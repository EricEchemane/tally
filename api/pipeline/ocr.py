"""Apple Vision OCR with upright detection and row grouping (SPEC §4).

Ported from the M1 benchmark (.wayfinder/liquidation-review/research/03-m1-bench/ocr.py).
ocrmac is imported lazily so the app still starts on Windows (fake pipeline mode).
"""
import statistics
import sys
from dataclasses import dataclass
from functools import lru_cache

from PIL import Image

from pipeline.crop import upright

# Vision returns (text, confidence, (x, y, w, h)) with normalized coords, y from the bottom.
Observation = tuple[str, float, tuple[float, float, float, float]]


@dataclass
class OcrResult:
    text: str          # grouped rows, top to bottom, "  " between items on a row
    rotation: int      # degrees applied to make the image upright (0, 90 or -90)


def _recognize_macos(img: Image.Image) -> list[Observation]:
    from ocrmac import ocrmac  # macOS only

    return ocrmac.OCR(img, recognition_level="accurate", language_preference=["en-US"]).recognize()


@lru_cache(maxsize=1)
def _windows_engine():
    """Load RapidOCR's local ONNX models once per sidecar process.

    Tuned on the receipt fixtures against Apple Vision (DESKTOP.md): the slow box score and no dilation keep
    tilted, tightly packed header lines (address, TIN) apart instead of merging or dropping them."""
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR(det_score_mode="slow", det_box_thresh=0.4, det_use_dilation=False)


def _recognize_windows(img: Image.Image) -> list[Observation]:
    """Normalize RapidOCR's top-left pixel boxes to Vision's bottom-left coordinate shape."""
    import numpy as np

    result, _ = _windows_engine()(np.asarray(img.convert("RGB")))
    if not result:
        return []
    width, height = img.size
    observations: list[Observation] = []
    for box, text, confidence in result:
        text = str(text).strip()
        if not text:
            continue
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        left, right = min(xs), max(xs)
        top, bottom = min(ys), max(ys)
        observations.append((text, float(confidence), (
            left / width, 1 - bottom / height, (right - left) / width, (bottom - top) / height,
        )))
    return observations


def _recognize(img: Image.Image) -> list[Observation]:
    return _recognize_windows(img) if sys.platform == "win32" else _recognize_macos(img)


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


OCR_MAX_SIDE = 2048  # full-resolution phone photos (4032 px) OCR 2–2.5x slower with no gain on receipts


def ocr_image(path: str) -> OcrResult:
    img = upright(path)  # the EXIF orientation, so `rotation` is relative to the photo as browsers show it
    img.thumbnail((OCR_MAX_SIDE, OCR_MAX_SIDE))  # only shrinks; the stored photo stays full size
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
