"""Throwaway benchmark: receipt -> JSON via Ollama, scored against truth.py."""
import sys, json, time, re, base64, io, subprocess, requests
from PIL import Image
from truth import TRUTH

OLLAMA = "http://localhost:11434/api/chat"
SAMPLES = "../../../../samples/receipts"

SCHEMA = {
 "type": "object",
 "properties": {
  "document_title": {"type": ["string", "null"], "description": "Title as printed, e.g. SALES INVOICE, SERVICE INVOICE, OFFICIAL RECEIPT"},
  "doc_type": {"type": "string", "enum": ["INVOICE", "OFFICIAL_RECEIPT", "OTHER"]},
  "seller_name": {"type": ["string", "null"]},
  "seller_tin": {"type": ["string", "null"], "description": "The SELLER's TIN as printed, including branch code"},
  "vat_registered": {"type": ["boolean", "null"]},
  "invoice_number": {"type": ["string", "null"]},
  "date": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
  "vatable_sales": {"type": ["number", "null"]},
  "vat_amount": {"type": ["number", "null"]},
  "vat_exempt_sales": {"type": ["number", "null"]},
  "zero_rated_sales": {"type": ["number", "null"]},
  "total": {"type": ["number", "null"]},
  "currency": {"type": "string", "enum": ["PHP", "USD", "OTHER"]},
  "buyer_name": {"type": ["string", "null"]},
  "buyer_tin": {"type": ["string", "null"]},
  "not_valid_for_input_tax_notice": {"type": "boolean"},
 },
 "required": ["document_title", "doc_type", "seller_name", "seller_tin", "vat_registered", "invoice_number", "date",
              "vatable_sales", "vat_amount", "vat_exempt_sales", "zero_rated_sales", "total", "currency",
              "buyer_name", "buyer_tin", "not_valid_for_input_tax_notice"],
}

SYSTEM = """You extract fields from Philippine receipts into JSON. Rules:
- The seller is the business at the TOP. Its TIN follows "VAT REG TIN" or "NON VAT REG TIN". Ignore the POS/software provider block at the BOTTOM (accreditation, PTU, "Date Issued"); its TIN is NOT the seller TIN.
- doc_type: INVOICE if titled Sales Invoice / Service Invoice / Invoice / "serves as your Sales Invoice"; OFFICIAL_RECEIPT if it says Official Receipt; OTHER for anything else, including non-Philippine receipts.
- vat_registered: true for "VAT REG", false for "NON VAT".
- buyer_name / buyer_tin: only if filled in on the Name/TIN lines; blank lines mean null.
- Amounts are plain numbers without currency symbols or commas. Use null when a value is not printed.
- not_valid_for_input_tax_notice: true only if the text says "NOT VALID FOR CLAIM OF INPUT TAX".
- Copy values exactly; never invent values."""

def call(model, messages, images=None):
    if images: messages[-1]["images"] = images
    body = {"model": model, "messages": messages, "format": SCHEMA, "stream": False,
            "options": {"temperature": 0, "num_ctx": 4096}, "keep_alive": "10m"}
    if model.startswith("qwen3"): body["think"] = False
    t = time.perf_counter()
    r = requests.post(OLLAMA, json=body, timeout=600).json()
    return r, time.perf_counter() - t

def digits(s): return re.sub(r"\D", "", s or "")

def score(pred, truth):
    res = {}
    d = digits(pred.get("seller_tin"))
    res["doc_type"] = pred.get("doc_type") == truth["doc_type"]
    res["seller_tin9"] = (d[:9] or None) == truth["seller_tin9"]
    res["branch"] = (d[9:] or None) == truth["branch"] if truth["seller_tin9"] else d == ""
    res["vat_registered"] = pred.get("vat_registered") == truth["vat_registered"]
    res["invoice_number"] = digits(pred.get("invoice_number")) == digits(truth["invoice_number"])
    res["date"] = pred.get("date") == truth["date"]
    for k in ("vatable_sales", "vat_amount", "vat_exempt_sales", "total"):
        p, t = pred.get(k), truth[k]
        res[k] = (p in (None, 0) and t in (None, 0)) or (p is not None and t is not None and abs(p - t) < 0.015)
    res["notice"] = bool(pred.get("not_valid_for_input_tax_notice")) == truth["not_valid_for_input_tax_notice"]
    return res

def image_b64(name, max_px=1100):
    for ext in (".jpg", ".png"):
        try: img = Image.open(f"{SAMPLES}/{name}{ext}").convert("RGB"); break
        except FileNotFoundError: pass
    img.thumbnail((max_px, max_px))
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode(), img.size

def swap_mb():
    out = subprocess.run(["sysctl", "-n", "vm.swapusage"], capture_output=True, text=True).stdout
    return float(re.search(r"used = ([\d.]+)M", out).group(1))

if __name__ == "__main__":
    model, mode = sys.argv[1], sys.argv[2]  # mode: text | vision
    for m in ("qwen3:4b", "qwen2.5:3b", "qwen3-vl:2b"): subprocess.run(["ollama", "stop", m], capture_output=True)
    results, swap0 = [], swap_mb()
    for i, name in enumerate(TRUTH):
        if mode == "text":
            msgs = [{"role": "system", "content": SYSTEM},
                    {"role": "user", "content": "Receipt OCR text:\n\n" + open(f"ocr/{name}.txt").read()}]
            r, dt = call(model, msgs)
        else:
            b64, size = image_b64(name)
            msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "Extract the fields from this receipt image."}]
            r, dt = call(model, msgs, [b64])
        try: pred = json.loads(r["message"]["content"]); ok_json = True
        except Exception: pred, ok_json = {}, False
        s = score(pred, TRUTH[name])
        row = {"file": name, "s": round(dt, 1), "prompt_tok": r.get("prompt_eval_count"), "out_tok": r.get("eval_count"),
               "json_ok": ok_json, "correct": sum(s.values()), "of": len(s), "wrong": [k for k, v in s.items() if not v], "pred": pred}
        results.append(row)
        print(f"{name:34s} {dt:6.1f}s  {row['correct']}/{row['of']}  wrong={row['wrong']}", flush=True)
    ps = subprocess.run(["ollama", "ps"], capture_output=True, text=True).stdout
    json.dump({"model": model, "mode": mode, "results": results, "ollama_ps": ps, "swap_mb_before": swap0, "swap_mb_after": swap_mb()},
              open(f"results-{model.replace(':', '_')}-{mode}.json", "w"), indent=1)
    tot = sum(x["correct"] for x in results); of = sum(x["of"] for x in results)
    times = [x["s"] for x in results]
    print(f"\n{model} {mode}: accuracy {tot}/{of} = {tot/of:.0%}; first {times[0]}s, warm median {sorted(times[1:])[len(times[1:])//2]}s")
    print(ps); print(f"swap MB: {swap0} -> {swap_mb()}")
