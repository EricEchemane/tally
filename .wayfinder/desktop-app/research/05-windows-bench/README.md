# Windows OCR and extraction benchmark

For the ticket [Measure OCR and extraction on Windows](../../issues/05-measure-windows-ocr-and-extraction.md). `bench_windows.py` runs the real pipeline with the OCR engine swapped: the same 2048 px downscale, sideways retry, `to_rows`, extraction prompt, `derive()` and ground truth (`api/tests/expected.py`) as `tests/test_derive.py`. So its accuracy compares directly with the M1 numbers.

## Measured on Eric's M1 (2026-10-09)

RapidOCR's ONNX models give the same text on any OS, so its **accuracy** below holds for Windows too. Its **speed** on Windows still has to be measured.

| | Apple Vision (committed fixtures) | RapidOCR 3.10 + onnxruntime |
|---|---|---|
| Field accuracy | **213/231 = 92%** | **203/231 = 88%** |
| OCR median | ~0.9 s | 1.43 s (first call ~20 s: engine load) |
| Model median (qwen3:4b, Metal) | ~15 s | 14.2 s, about 19 tok/s generation |
| Sideways photo (`dup-mrdiy-rotated`) | found | found (-90°) |

**RapidOCR's misses, and whether they are flagged:**
- **Seller TIN missed on 4 receipts, never wrong.** All come back as no TIN, which is flagged NEEDS_REVIEW. On `bayanihan-corp-1` the OCR line was perfect ("VAT REG TIN: 987-654-321-00000"), but the model copied "987-654-3:321-00000". On the Mercury receipts the model picked the footer provider TIN, which code rejects as designed.
- **Wrong amounts: all 4 fail the VAT arithmetic check**, so they are flagged as on the M1.
- **Silent errors, which need a derive fix:**
  - The invoice number came out as "INVÓICE", a date ("2026-10-09"), a MIN ("MIN#2511…") or with a full-width colon ("：  00002431"). `parse_invoice_number` should reject dates, MINs and label words, and strip full-width punctuation.
  - The US receipt's date was read as 2019-11-02 instead of 2019-02-11 (day and month swapped).
- **Better than Vision on 2:** it read Petron's curved "SALES INVOICE" title (scored as wrong only because the ground truth expects Vision to miss it), and it read Juana's seller name cleanly.
- **Demo impact on Windows:** `bayanihan-corp-1` would land as NEEDS_REVIEW (missing seller TIN) instead of ✅. That's from the model's copy error, so it may not repeat on another run.

Raw results: `results-rapidocr-engineex.json` and `results-rapidocr-ocr-only-engineex.json`.

## Checklist for Simon (Windows)

Plug the laptop in, close other apps, and use `main`'s sample receipts (pull `plan/desktop-app`).

1. **Machine:** note the CPU model, RAM (Task Manager → Performance → Memory: size and "Slots used") and GPU (Task Manager → Performance → GPU).
2. **Ollama:** install from ollama.com (a normal install is fine). Note whether any window, UAC or SmartScreen prompt appeared. Then run `ollama pull qwen3:4b`.
3. **Baseline check:** `cd api` then `uv run python ..\.wayfinder\desktop-app\research\05-windows-bench\bench_windows.py --baseline`. It should print `213/231 = 92%`.
4. **RapidOCR speed and accuracy:**
   `uv run --with rapidocr --with onnxruntime python ..\.wayfinder\desktop-app\research\05-windows-bench\bench_windows.py --engine rapidocr`
   If onnxruntime fails to load, install the Microsoft VC++ 2015–2022 x64 redistributable and note that it was needed.
5. **Windows built-in OCR:** check Settings → Time & language → Language & region → English (United States) → Language options → Optical character recognition. Note whether it was already installed. Then:
   `uv run --with winrt-runtime --with winrt-Windows.Media.Ocr --with winrt-Windows.Graphics.Imaging --with winrt-Windows.Storage.Streams --with winrt-Windows.Globalization --with winrt-Windows.Foundation --with winrt-Windows.Foundation.Collections python ..\.wayfinder\desktop-app\research\05-windows-bench\bench_windows.py --engine winocr`
6. **GPU:** the summary's `"gpu"` line shows `size_vram`; 0 means the model ran on the CPU. Also search `%LOCALAPPDATA%\Ollama\server.log` for "dropping integrated GPU".
7. **Intel/AMD integrated GPU only:** quit Ollama from the tray, set a user environment variable `OLLAMA_IGPU_ENABLE=1`, start Ollama again and repeat step 4 with `--samples valid-7eleven valid-bf-sinangag bayanihan-corp-1 mercury-drug-730 valid-landmark-vat-exempt-mix`. Then remove the variable.
8. **Send back** the `results-*.json` files from this folder (commit them to `plan/desktop-app`) along with the notes from steps 1, 2, 5 and 6.

The script is throwaway and doesn't change any product code. If something fails, paste the traceback.
