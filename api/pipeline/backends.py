"""Real vs fake pipeline back ends (SPEC §2). Everything after extraction is shared code."""
import asyncio
import hashlib
import json
from functools import lru_cache
from pathlib import Path

import config
from pipeline.ocr import OcrResult

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "receipts"


class RealBackend:
    """Apple Vision OCR on macOS or RapidOCR on Windows, then qwen3:4b."""

    async def ocr(self, image_path: str, cropped_path: str | None = None) -> OcrResult:
        from pipeline.ocr import ocr_image

        return await asyncio.to_thread(ocr_image, cropped_path or image_path)

    async def extract(self, ocr_text: str, image_path: str) -> dict:
        from llm.extraction import extract

        return await asyncio.to_thread(extract, ocr_text)


class FakeBackend:
    """Replays committed fixtures. A known sample image gets its real OCR text and extraction;
    anything else gets a fixture picked by its hash, so the stages still play out (SPEC §2)."""

    async def ocr(self, image_path: str, cropped_path: str | None = None) -> OcrResult:
        # Fixtures are keyed by the Receipt Photo, so a cropped upload still replays its own fixture.
        await asyncio.sleep(0.5 * config.FAKE_DELAY)
        fixture = _fixture_for(image_path)
        meta = json.loads((fixture / "meta.json").read_text(encoding="utf-8"))
        return OcrResult(text=(fixture / "ocr.txt").read_text(encoding="utf-8"), rotation=meta["rotation"])

    async def extract(self, ocr_text: str, image_path: str) -> dict:
        await asyncio.sleep(3 * config.FAKE_DELAY)
        return json.loads((_fixture_for(image_path) / "extraction.json").read_text(encoding="utf-8"))


@lru_cache
def _fixtures_by_hash() -> dict[str, Path]:
    out = {}
    for meta in sorted(FIXTURES.glob("*/meta.json")):
        out[json.loads(meta.read_text(encoding="utf-8"))["image_sha256"]] = meta.parent
    return out


def _fixture_for(image_path: str) -> Path:
    digest = hashlib.sha256(Path(image_path).read_bytes()).hexdigest()
    known = _fixtures_by_hash()
    if digest in known:
        return known[digest]
    ordered = sorted(known.values())
    return ordered[int(digest, 16) % len(ordered)]


def backend():
    return FakeBackend() if config.FAKE_PIPELINE else RealBackend()
