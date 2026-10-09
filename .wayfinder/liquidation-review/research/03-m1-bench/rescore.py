import json, sys
from bench import score
from truth import TRUTH
from post import post
for f in sys.argv[1:]:
    d = json.load(open(f)); tot = of = 0; fails = {}
    for r in d["results"]:
        ocr = open(f"ocr/{r['file']}.txt").read()
        s = score(post(r["pred"], ocr), TRUTH[r["file"]]); tot += sum(s.values()); of += len(s)
        for k, v in s.items():
            if not v: fails.setdefault(k, []).append(r["file"])
    times = [r["s"] for r in d["results"]]
    print(f"{d['model']} {d['mode']}: raw {sum(r['correct'] for r in d['results'])}/{of}, with post-processing {tot}/{of} = {tot/of:.0%}; warm median {sorted(times[1:])[len(times)//2-1]}s")
    for k, v in fails.items(): print("   ", k, v)
