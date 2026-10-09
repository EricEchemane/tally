"""Would a plain VAT arithmetic check (proto check 4) flag the extraction errors instead of passing them silently?"""
import json, sys
from bench import score
from truth import TRUTH
from post import post
def arith_ok(p):
    v, a, e, z, t = (p.get(k) or 0 for k in ("vatable_sales", "vat_amount", "vat_exempt_sales", "zero_rated_sales", "total"))
    if not p.get("vat_registered"): return True
    return abs(v * 0.12 - a) <= 0.05 and abs(v + a + e + z - t) <= 0.05
for f in sys.argv[1:]:
    d = json.load(open(f)); print(d["model"])
    for r in d["results"]:
        p = post(r["pred"], open(f"ocr/{r['file']}.txt").read())
        s = score(p, TRUTH[r["file"]])
        amt_wrong = not all(s[k] for k in ("vatable_sales", "vat_amount", "total"))
        if amt_wrong or not arith_ok(p):
            print(f"   {r['file']:32s} amounts_wrong={amt_wrong!s:5s} arithmetic_check_flags={not arith_ok(p)}")
