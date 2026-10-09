# Measure OCR and extraction on the 8GB M1

Type: task (AFK)
Status: resolved
Blocked by: 02

## Question

On the actual M1 (8GB), how fast and how accurate is the OCR-first pipeline (ocrmac → Qwen3 4B or Qwen2.5 3B with a JSON Schema) on the sample receipts, compared with Qwen3-VL 2B directly? Which model is the pick?

### What to do (throwaway script, not product code)

1. Install Ollama; pull `qwen3:4b`, `qwen2.5:3b` and `qwen3-vl:2b`. `pip install ocrmac`.
2. For each sample receipt, record:
   - OCR time and OCR text quality, plus whether ocrmac confidence drops on faded tapes (this feeds the check 7 fog)
   - LLM extraction time (cold and warm)
   - Whether the JSON is valid
   - Field accuracy for seller name, seller TIN + branch, document title, date, VATable sales, VAT, total, buyer name/TIN
3. Repeat the extraction with Qwen3-VL 2B on images downscaled to about 1MP.
4. Note peak memory pressure (Activity Monitor or `vm_stat`) with the browser open.

Resolve with:
- a small table of results
- the chosen model and its settings (`num_ctx`, keep_alive, temperature)
- the per-receipt latency budget the demo can promise
- whether the VLM fallback is worth building

Link the script and results from this ticket; they live under `.wayfinder/liquidation-review/research/`.

## Answer

**Pick: OCR-first, Apple Vision (`ocrmac`) → qwen3:4b**, plus code post-processing and a VAT arithmetic repair. Field accuracy is **90%** on the 13 samples, about **15 s per receipt warm** (~25 s cold), with 2.9 GB of model RAM.

| Pipeline | Accuracy (final) | Warm s/receipt |
|---|---|---|
| OCR → qwen3:4b | **90%** | ~14 |
| OCR → qwen2.5:3b | 88% (invents a missing date) | ~11 |
| qwen3-vl:2b-instruct on image | 84% (misreads TINs, invents a date) | ~12 |
| qwen3-vl:2b default tag | 26% (always thinks, no JSON) | ~90 |

- **Settings:** `think:false`, temperature 0, JSON Schema `format`, `num_ctx` 4096 (2048 is probably enough), `num_predict` 600, `keep_alive` -1, one model loaded.
- **OCR needs row grouping and upright detection** before the LLM sees it.
- **The LLM reads; code decides.** Code parses dates and invoice numbers, and keyword matching decides doc type, VAT/Non-VAT and the "NOT VALID FOR CLAIM" notice.
- **The VAT arithmetic check flagged every wrong amount** with no false flags. A repair that searches the OCR numbers fixed 3 of 4; the blurry duplicate stays flagged.
- **Legibility (check 7):** OCR confidence is useless (the faded OR scored 0.988). Use unrepairable arithmetic, missing fields or few OCR rows instead.
- **Vision fallback:** not worth building for the MVP.
- **Memory:** swap grew to 3.9 GB with Chrome open. Close apps before the demo.

[Findings](../research/03-m1-bench/FINDINGS.md) · scripts and raw results in [research/03-m1-bench/](../research/03-m1-bench/)

## Comments
