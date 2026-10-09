"""Windows OCR + qwen3:4b benchmark (ticket: Measure OCR and extraction on Windows). Throwaway, not product code.

Run from api/ so the real pipeline modules import:

    cd api
    uv run --with rapidocr --with onnxruntime python ../.wayfinder/desktop-app/research/05-windows-bench/bench_windows.py --engine rapidocr
    uv run --with winrt-runtime --with winrt-Windows.Media.Ocr --with winrt-Windows.Graphics.Imaging ^
        --with winrt-Windows.Storage.Streams --with winrt-Windows.Globalization --with winrt-Windows.Foundation ^
        --with winrt-Windows.Foundation.Collections python ../.wayfinder/desktop-app/research/05-windows-bench/bench_windows.py --engine winocr

Options: --ocr-only (skip the model), --samples a b c (file stems), --baseline (score the committed M1 fixtures only).
Each engine is scored with the same derive() and ground truth as tests/test_derive.py, so the numbers compare
directly with the M1 run. Results go to results-<engine>-<host>.json next to this script.
"""
import argparse
import asyncio
import io
import json
import platform
import socket
import statistics
import sys
import time
from pathlib import Path

import httpx
from PIL import Image

API = Path(__file__).resolve().parents[4] / "api"
sys.path.insert(0, str(API))  # the real pipeline modules

import config  # noqa: E402
from llm.extraction import SCHEMA, SYSTEM
from money import to_pesos
from pipeline.derive import derive
from pipeline.ocr import OCR_MAX_SIDE, is_sideways, to_rows
from tests.expected import EXPECTED, SKIP

SAMPLES = API.parent / "samples" / "receipts"
FIXTURES = API / "tests" / "fixtures" / "receipts"
OUT = Path(__file__).resolve().parent
AMOUNTS = {"vatable_sales", "vat_amount", "vat_exempt_sales", "total"}


# --- OCR engines, each returning Vision-style observations: (text, conf, (x, y, w, h)), normalized, y from the bottom


def _norm(text, conf, x0, y0, x1, y1, W, H):
    return (text, float(conf), (x0 / W, 1 - y1 / H, (x1 - x0) / W, (y1 - y0) / H))


_rapid = None


def rapidocr(img: Image.Image):
    global _rapid
    if _rapid is None:
        from rapidocr import RapidOCR
        _rapid = RapidOCR()
    res = _rapid(img)
    if res.boxes is None:
        return []
    W, H = img.size
    obs = []
    for box, text, score in zip(res.boxes, res.txts, res.scores):
        xs, ys = [p[0] for p in box], [p[1] for p in box]
        obs.append(_norm(text, score, min(xs), min(ys), max(xs), max(ys), W, H))
    return obs


async def _winocr(img: Image.Image):
    from winrt.windows.globalization import Language
    from winrt.windows.graphics.imaging import BitmapDecoder
    from winrt.windows.media.ocr import OcrEngine
    from winrt.windows.storage.streams import DataWriter, InMemoryRandomAccessStream

    engine = OcrEngine.try_create_from_language(Language("en-US"))
    if engine is None:
        sys.exit("Windows OCR for en-US is not installed: Settings > Time & language > Language > English (US) > Options > OCR")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    stream = InMemoryRandomAccessStream()
    writer = DataWriter(stream)
    writer.write_bytes(buf.getvalue())
    await writer.store_async()
    writer.detach_stream()
    stream.seek(0)
    bitmap = await (await BitmapDecoder.create_async(stream)).get_software_bitmap_async()
    result = await engine.recognize_async(bitmap)
    W, H = img.size
    obs = []
    for line in result.lines:
        rects = [w.bounding_rect for w in line.words]
        x0, y0 = min(r.x for r in rects), min(r.y for r in rects)
        x1, y1 = max(r.x + r.width for r in rects), max(r.y + r.height for r in rects)
        obs.append(_norm(line.text, 1.0, x0, y0, x1, y1, W, H))  # no confidence from Windows OCR
    return obs


def winocr(img: Image.Image):
    return asyncio.run(_winocr(img))


ENGINES = {"rapidocr": rapidocr, "winocr": winocr}


def ocr_image(path: Path, recognize):
    """Same steps as api/pipeline/ocr.py, with the engine swapped."""
    img = Image.open(path).convert("RGB")
    img.thumbnail((OCR_MAX_SIDE, OCR_MAX_SIDE))
    obs, rotation = recognize(img), 0
    if is_sideways(obs):
        best = None
        for angle in (-90, 90):
            candidate = recognize(img.rotate(angle, expand=True))
            score = sum(len(t) * c for t, c, _ in candidate)
            if best is None or score > best[0]:
                best = (score, candidate, angle)
        _, obs, rotation = best
    return to_rows(obs), rotation


# --- extraction with Ollama's own timings (same request as api/llm/client.py)


def extract_timed(ocr_text: str):
    body = {"model": config.MODEL,
            "messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": "Receipt OCR text:\n\n" + ocr_text}],
            "format": SCHEMA, "stream": False, "think": False, "keep_alive": -1,
            "options": {"temperature": 0, "num_ctx": 4096, "num_predict": 600}}
    r = httpx.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=600).json()
    ns = 1e9
    stats = {"load_s": r.get("load_duration", 0) / ns, "prompt_tokens": r.get("prompt_eval_count", 0),
             "prompt_s": r.get("prompt_eval_duration", 0) / ns, "gen_tokens": r.get("eval_count", 0),
             "gen_s": r.get("eval_duration", 0) / ns, "total_s": r.get("total_duration", 0) / ns}
    return json.loads(r["message"]["content"]), stats


# --- scoring, as in tests/test_derive.py


def _matches(field, got, want):
    if field in AMOUNTS:
        got = to_pesos(got)
        return (got in (None, 0) and want in (None, 0)) or (None not in (got, want) and abs(got - want) < 0.015)
    return got == want


def score(name, extraction, ocr_text):
    d = derive(extraction, ocr_text)
    want = EXPECTED[name]
    wrong = sorted(k for k, v in want.items() if v is not SKIP and not _matches(k, d.get(k), v))
    return sum(v is not SKIP for v in want.values()), wrong


def machine_info():
    info = {"host": socket.gethostname(), "os": platform.platform(), "cpu": platform.processor() or platform.machine(),
            "python": platform.python_version(), "model": config.MODEL}
    try:
        info["ollama"] = httpx.get(f"{config.OLLAMA_URL}/api/version", timeout=3).json().get("version")
    except httpx.HTTPError:
        info["ollama"] = None
    return info


def gpu_offload():
    """After a call, /api/ps says how much of the model sits in GPU memory (0 = CPU only)."""
    try:
        for m in httpx.get(f"{config.OLLAMA_URL}/api/ps", timeout=3).json().get("models", []):
            if m["name"].startswith(config.MODEL.split(":")[0]):
                return {"size": m["size"], "size_vram": m["size_vram"]}
    except httpx.HTTPError:
        pass
    return None


def baseline():
    total = correct = 0
    for name in EXPECTED:
        d = FIXTURES / name
        n, wrong = score(name, json.loads((d / "extraction.json").read_text(encoding="utf-8")),
                         (d / "ocr.txt").read_text(encoding="utf-8"))
        meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
        total, correct = total + n, correct + n - len(wrong)
        print(f"{name:36s} ocr {meta['ocr_seconds']:>5}s  llm {meta['llm_seconds']:>5}s  wrong: {', '.join(wrong) or '-'}")
    print(f"\nM1 baseline (Apple Vision + qwen3:4b): {correct}/{total} = {correct / total:.0%}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=list(ENGINES))
    ap.add_argument("--ocr-only", action="store_true")
    ap.add_argument("--baseline", action="store_true")
    ap.add_argument("--samples", nargs="*")
    a = ap.parse_args()
    if a.baseline:
        return baseline()
    if not a.engine:
        ap.error("--engine is required (or --baseline)")

    info = machine_info()
    print(json.dumps(info))
    images = sorted(p for p in SAMPLES.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if a.samples:
        images = [p for p in images if p.stem in set(a.samples)]
    if not a.ocr_only:
        print("warming the model...", flush=True)
        extract_timed("warmup")

    rows, total, correct = [], 0, 0
    for p in images:
        t0 = time.perf_counter()
        text, rotation = ocr_image(p, ENGINES[a.engine])
        ocr_s = time.perf_counter() - t0
        row = {"sample": p.stem, "ocr_s": round(ocr_s, 2), "rotation": rotation, "ocr_text": text}
        if not a.ocr_only:
            extraction, stats = extract_timed(text)
            n, wrong = score(p.stem, extraction, text)
            total, correct = total + n, correct + n - len(wrong)
            row |= {"llm": {k: round(v, 2) for k, v in stats.items()}, "extraction": extraction, "wrong": wrong}
        rows.append(row)
        llm = row.get("llm", {})
        print(f"{p.stem:36s} ocr {ocr_s:5.2f}s rot {rotation:>3}  "
              + (f"llm {llm['total_s']:5.1f}s ({llm['gen_tokens']/max(llm['gen_s'], 1e-9):4.1f} tok/s gen, "
                 f"{llm['prompt_tokens']/max(llm['prompt_s'], 1e-9):5.1f} tok/s prompt)  wrong: {', '.join(row['wrong']) or '-'}"
                 if llm else ""), flush=True)

    summary = {"ocr_median_s": round(statistics.median(r["ocr_s"] for r in rows), 2)}
    if not a.ocr_only:
        summary |= {"accuracy": f"{correct}/{total} = {correct / total:.0%}",
                    "llm_median_s": round(statistics.median(r["llm"]["total_s"] for r in rows), 1),
                    "gpu": gpu_offload()}
    print("\n" + json.dumps(summary, indent=2))
    out = OUT / f"results-{a.engine}{'-ocr-only' if a.ocr_only else ''}-{info['host']}.json"
    out.write_text(json.dumps({"machine": info, "summary": summary, "results": rows}, indent=2, ensure_ascii=False),
                   encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
