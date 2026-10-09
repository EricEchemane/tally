# Measure OCR and extraction on the 8GB M1

Type: task (AFK)
Status: claimed
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

## Comments
