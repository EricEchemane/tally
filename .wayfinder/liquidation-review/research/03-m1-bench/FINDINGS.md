# M1 (8GB) extraction benchmark: findings

Run on 2026-10-09 on the user's M1 MacBook Pro (8GB), Ollama 0.40.2, with Chrome open. The data was the 13 receipts in `samples/receipts/`, scored on 11 fields each (143 total) against `truth.py`, which was read by hand from the README.

These are throwaway scripts, not product code:
- `ocr.py`: Apple Vision OCR, upright rotation, row grouping
- `bench.py`: Ollama extraction and scoring
- `post.py`: code normalization
- `arith.py` / `repair.py`: VAT arithmetic check and repair
- `results-*.json`: raw outputs

## Results

| Pipeline | Raw | + code post-processing | + VAT repair | Warm s/receipt | First call | Model RAM |
|---|---|---|---|---|---|---|
| **OCR → qwen3:4b (think off)** | 80% | 87% | **90%** | **~14 s** | 22 s | 2.9 GB |
| OCR → qwen2.5:3b | 78% | 85% | 88% | ~11 s | 15 s | 2.1 GB |
| qwen3-vl:2b-instruct on image (~1.1MP) | 73% | 80% | 84% | ~12 s | 20 s | 1.8 GB |
| qwen3-vl:2b (default tag) | 26% | n/a | n/a | ~90 s | n/a | 1.8 GB |

- **Apple Vision OCR (`ocrmac`):** ~0.4–0.7 s per receipt, 1.6 s when rotated (it OCRs twice to pick the orientation).
- **Default `qwen3-vl:2b` tag:** it always thinks and ignores `think:false`. It used up the whole output budget reasoning and produced no JSON. Use `qwen3-vl:2b-instruct` if a vision model is ever needed.

## What mattered

1. **The OCR text needs two fixes before the LLM sees it.**
   - **Row grouping:** Vision returns labels and values as separate observations; join the ones whose vertical centers overlap into one printed row.
   - **Upright detection:** if the median box is tall and narrow, rotate ±90° and keep the better pass.
   - Without these, the rotated Mr DIY receipt and every "label … value" pair came out scrambled.
2. **Let the LLM read and let code decide.** The LLM wrote dates in whatever format was printed, added prefixes to invoice numbers ("SI #:"), and judged the document type badly. Taking these out of the LLM's hands raised accuracy by 7 points:
   - code parses dates and strips prefixes
   - keyword matching decides `doc_type` (INVOICE / OFFICIAL RECEIPT), `vat_registered` ("VAT REG" / "NON VAT") and the "NOT VALID FOR CLAIM OF INPUT TAX" notice
3. **Amount errors come from printed misalignment** (Lawson, Petron, llaollao, where values are shifted one row from their labels) and from blur (the 7-Eleven duplicate).
   - **The VAT arithmetic check** (VATable × 12% = VAT, and the parts sum to the total) **flagged every wrong amount on a PH VAT receipt, with zero false flags on correct ones.** Extraction errors never pass silently.
   - **Repair:** when the arithmetic fails, search the OCR numbers for a VATable/VAT/exempt/total set that satisfies it, preferring the LLM's total. This fixed Lawson, Petron and llaollao. Only the blurry duplicate remained flagged.
4. **Seller TIN (the most important field for the checks):**
   - qwen3:4b got it right on every receipt that has one. It correctly ignored the POS-provider TIN at the bottom.
   - The vision model misread it on 3 receipts.
   - Branch code: the Mouthfeel TIN wraps across lines ("…-00" / "0"), and both text models dropped the last digit. Code can rejoin a 1–2 digit line that follows a TIN.
5. **Made-up values:**
   - qwen2.5:3b and the vision model both invented a date for the receipt whose date is cropped off. qwen3:4b correctly returned null.
   - qwen3:4b's main weakness: it reported the Cebu Official Receipt's MIN (machine number) as its TIN. Code can reject it, since it isn't 9 + 3–5 digits.
6. **OCR confidence is useless for legibility (check 7).**
   - The faded 2022 Official Receipt averaged 0.988 confidence; the clean Mouthfeel invoice averaged 1.0.
   - Better legibility signals: arithmetic failure that can't be repaired, required fields missing, or very few OCR rows.
7. **Memory is tight.**
   - With qwen3:4b loaded and Chrome open, swap grew from 1.4 to 3.9 GB. The thinking VLM pushed it to 5.7 GB.
   - Only one model fits comfortably. For the demo, close Chrome tabs, keep the model warm, and use `OLLAMA_MAX_LOADED_MODELS=1`.

## Decision

- **Model:** OCR-first with **qwen3:4b**.
  - Settings: `think:false`, `temperature:0`, `format:` JSON Schema, `num_ctx:4096` (prompts are 500–900 tokens, so 2048 is probably enough and saves memory), `num_predict:600`, `keep_alive:-1`.
  - qwen2.5:3b is the fallback if speed or memory becomes a problem: about 3 s faster, but it makes up dates.
- **Latency budget:** about **15 s per receipt warm** (0.5 s OCR + ~14 s LLM) and ~25 s for the first receipt after a cold load. Ways to make that acceptable in the demo:
  - Stream stages ("text read" in under 1 s, then fields and checks around 15 s).
  - Queue the uploads so the phone keeps capturing.
  - Pre-warm the model.
  - A trimmed schema (dropping the fields code now decides) should cut output tokens. Not measured.
- **Vision fallback:** don't build it for the MVP. It is less accurate on TINs, makes up dates, isn't faster, and would need a model swap within 8GB.
