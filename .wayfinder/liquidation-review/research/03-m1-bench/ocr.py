"""Throwaway benchmark: Apple Vision OCR with upright-rotation and row grouping."""
import sys, time, json, glob, os, statistics
from ocrmac import ocrmac
from PIL import Image

def recognize(img):
    return ocrmac.OCR(img, recognition_level="accurate", language_preference=["en-US"]).recognize()

def upright(path):
    img = Image.open(path).convert("RGB")
    res = recognize(img)
    # bbox = (x, y, w, h), normalized. Sideways text produces tall, narrow boxes.
    if res and statistics.median(r[2][3] / max(r[2][2], 1e-6) for r in res) > 1.5:
        best = None
        for angle in (-90, 90):
            r2 = recognize(img.rotate(angle, expand=True))
            score = sum(len(t) * c for t, c, _ in r2)
            if best is None or score > best[0]:
                best = (score, r2, angle)
        return best[1], best[2]
    return res, 0

def to_rows(res):
    """Group observations whose vertical centres overlap into one printed row, left to right."""
    obs = sorted(res, key=lambda r: -(r[2][1] + r[2][3] / 2))
    rows = []
    for t, c, (x, y, w, h) in obs:
        cy = y + h / 2
        if rows and abs(rows[-1]["cy"] - cy) < 0.6 * min(h, rows[-1]["h"]):
            rows[-1]["items"].append((x, t)); continue
        rows.append({"cy": cy, "h": h, "items": [(x, t)]})
    return "\n".join("  ".join(t for _, t in sorted(r["items"])) for r in rows)

if __name__ == "__main__":
    os.makedirs("ocr", exist_ok=True)
    out = []
    files = sorted(glob.glob(os.path.join(sys.argv[1], "*.jpg")) + glob.glob(os.path.join(sys.argv[1], "*.png")))
    recognize(Image.open(files[0]))  # warm up the Vision model
    for p in files:
        name = os.path.splitext(os.path.basename(p))[0]
        t = time.perf_counter()
        res, angle = upright(p)
        text = to_rows(res)
        dt = time.perf_counter() - t
        confs = [r[1] for r in res]
        open(f"ocr/{name}.txt", "w").write(text)
        out.append({"file": name, "ocr_s": round(dt, 2), "rotated": angle, "rows": text.count("\n") + 1,
                    "mean_conf": round(sum(confs) / len(confs), 3), "min_conf": round(min(confs), 2)})
        print(out[-1], flush=True)
    json.dump(out, open("ocr_results.json", "w"), indent=1)
