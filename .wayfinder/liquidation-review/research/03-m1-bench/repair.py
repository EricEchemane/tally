"""When VAT arithmetic fails, look in the OCR text for numbers that satisfy it: vatable*0.12 = vat, vatable + vat + exempt = total."""
import re, json, sys, itertools
from bench import score
from truth import TRUTH
from post import post
from arith import arith_ok
def numbers(ocr):
    return sorted({float(m.replace(",", "")) for m in re.findall(r"(?<![\d.])\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)", ocr)})
def repair(p, ocr):
    if not p.get("vat_registered") or arith_ok(p): return p, False
    nums = numbers(ocr); cands = []
    for v, a in itertools.permutations(nums, 2):
        if v > 0 and abs(v * 0.12 - a) <= 0.02:
            for t in nums:
                for e in [0.0] + nums:
                    if abs(v + a + e - t) <= 0.02: cands.append((t, v, a, e))
    if not cands: return p, False
    # prefer the total the LLM read, then no exempt part, then the largest total
    t, v, a, e = max(cands, key=lambda c: (abs(c[0] - (p.get("total") or 0)) < 0.02, c[3] == 0, c[0]))
    return {**p, "vatable_sales": v, "vat_amount": a, "vat_exempt_sales": e, "total": t}, True
if __name__ == "__main__":
    for f in sys.argv[1:]:
        d = json.load(open(f)); tot = of = 0
        for r in d["results"]:
            ocr = open(f"ocr/{r['file']}.txt").read()
            p, fixed = repair(post(r["pred"], ocr), ocr)
            s = score(p, TRUTH[r["file"]]); tot += sum(s.values()); of += len(s)
            if fixed: print(f"   repaired {r['file']:32s} -> amounts now correct: {all(s[k] for k in ('vatable_sales','vat_amount','total'))}")
        print(f"{d['model']}: with post-processing + repair {tot}/{of} = {tot/of:.0%}")
