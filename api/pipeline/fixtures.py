"""Generate committed fixtures from the real pipeline (macOS + Ollama only). SPEC §8.

    uv run python -m pipeline.fixtures [stem ...]

Writes tests/fixtures/receipts/<sample>/{ocr.txt, extraction.json, meta.json}. Fake pipeline mode
and the tests replay these, so Windows never needs ocrmac or the model.
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import config
from llm.extraction import extract
from pipeline.ocr import ocr_image

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT.parent / "samples" / "receipts"
FIXTURES = ROOT / "tests" / "fixtures" / "receipts"


def sample_images() -> list[Path]:
    return sorted(p for p in SAMPLES.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})


def generate(image: Path) -> dict:
    out = FIXTURES / image.stem
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    ocr = ocr_image(str(image))
    t1 = time.perf_counter()
    extraction = extract(ocr.text)
    t2 = time.perf_counter()
    (out / "ocr.txt").write_text(ocr.text)
    (out / "extraction.json").write_text(json.dumps(extraction, indent=2, ensure_ascii=False) + "\n")
    meta = {"image": image.name, "image_sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
            "rotation": ocr.rotation, "model": config.MODEL,
            "ocr_seconds": round(t1 - t0, 2), "llm_seconds": round(t2 - t1, 1)}
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta


if __name__ == "__main__":
    wanted = set(sys.argv[1:])
    for image in sample_images():
        if wanted and image.stem not in wanted:
            continue
        m = generate(image)
        print(f"{image.stem:38s} ocr {m['ocr_seconds']:>5}s  llm {m['llm_seconds']:>5}s  rot {m['rotation']}", flush=True)
