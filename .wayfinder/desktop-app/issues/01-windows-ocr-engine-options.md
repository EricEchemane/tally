# Windows OCR engine options

Type: research (AFK)
Status: resolved
Assignee:
Blocked by: none

## Question

Apple Vision (`ocrmac`) only runs on macOS. Which OCR engines can replace it on Windows 10/11 x64, called from the Python backend and packaged inside the sidecar? Compare at least Windows.Media.Ocr (via `winsdk`/`winrt`), RapidOCR (ONNX) and PaddleOCR on:
- what our pipeline needs: line text with bounding boxes (row grouping, the bottom-40% provider-TIN rule), rotation handling, Tagalog/English
- install and packaged size, CPU-only speed, licence
- whether it needs the user to add a Windows language pack
- known accuracy on receipts or thermal-printed text

End with a shortlist of 1–2 engines to measure on the sample receipts.

## Answer

**Full findings are in [research/01-windows-ocr.md](../research/01-windows-ocr.md)** (web research only; nothing was run on Windows). Measure two engines:
1. **RapidOCR + onnxruntime (first choice).** It runs PaddleOCR's PP-OCR models, ranked well ahead of Tesseract on receipts by a vendor benchmark. Apache-2.0/MIT. The models are inside a 27 MB wheel, so nothing downloads at runtime; it adds roughly 100–150 MB to the sidecar. It returns a box, text and score per line, so `to_rows`, the bottom-40% TIN rule and the ±90° retry should carry over. CPU speed at 2048 px is unmeasured (estimated 1–2 s). It needs the VC++ runtime.
2. **Windows.Media.Ocr via `winrt-Windows.Media.Ocr` (fallback).** Built in, under 1 MB, fast. It gives word boxes only, with no confidence; line boxes would have to be built from the words. Rotated text isn't documented. It needs the en-US OCR language feature, which the wizard would have to check for.

Dropped: **PaddleOCR** itself (a heavy dependency, and its own docs say packaging with Nuitka or PyInstaller is unsupported or awkward). No Tagalog model is needed: the receipts are English plus Filipino names in Latin script.
