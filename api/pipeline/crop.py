"""Cropped Photo: the receipt's four corners, as confirmed on the phone, straightened into a rectangle.

The phone finds the corners (docs/adr/0001-receipt-edge-detection-on-the-phone.md); this only applies
them, with Pillow's perspective transform, so the backend needs no OpenCV. Corners are fractions (0–1)
of the upright photo, i.e. after its EXIF orientation, which is how the phone's browser shows it.
"""
import json
import math
import uuid
from pathlib import Path

from PIL import Image, ImageOps

Corners = list[tuple[float, float]]  # top-left, top-right, bottom-right, bottom-left


def parse_corners(raw) -> Corners | None:
    """Validate one photo's corners from the upload: None, or 4 [x, y] pairs inside the photo.
    Raises ValueError on anything else."""
    if raw is None:
        return None
    if not (isinstance(raw, list) and len(raw) == 4):
        raise ValueError("corners must be 4 points")
    pts = []
    for p in raw:
        if not (isinstance(p, list) and len(p) == 2 and all(isinstance(v, (int, float)) for v in p)):
            raise ValueError("each corner must be [x, y]")
        x, y = float(p[0]), float(p[1])
        if not (0 <= x <= 1 and 0 <= y <= 1):
            raise ValueError("corners must be fractions of the photo, 0 to 1")
        pts.append((x, y))
    if _area(pts) < 0.01:
        raise ValueError("corners enclose almost nothing")
    return pts


def parse_corners_list(raw: str | None, count: int) -> list[Corners | None]:
    """The upload's `corners` form field: a JSON array with one entry (null or 4 points) per image."""
    if raw is None:
        return [None] * count
    items = json.loads(raw)
    if not isinstance(items, list) or len(items) != count:
        raise ValueError("corners needs one entry per image")
    return [parse_corners(c) for c in items]


def upright(path: str | Path) -> Image.Image:
    """The photo as a person sees it: EXIF orientation applied, RGB."""
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def save_cropped(photo_path: Path, corners: Corners, images_dir: Path) -> Path:
    img = upright(photo_path)
    w, h = img.size
    tl, tr, br, bl = [(x * w, y * h) for x, y in corners]
    out_w = round(max(math.dist(tl, tr), math.dist(bl, br)))
    out_h = round(max(math.dist(tl, bl), math.dist(tr, br)))
    coeffs = _perspective_coeffs([(0, 0), (out_w, 0), (out_w, out_h), (0, out_h)], [tl, tr, br, bl])
    cropped = img.transform((out_w, out_h), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    path = images_dir / f"{uuid.uuid4().hex}-cropped.jpg"
    cropped.save(path, "JPEG", quality=92)
    return path


def _perspective_coeffs(dst, src) -> list[float]:
    """The 8 coefficients Pillow wants: they map each output point (dst) back to the input (src)."""
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.append(v)
    return _solve(rows, rhs)


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting; 8x8, so no numpy."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            raise ValueError("corners don't form a quadrilateral")
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(n):
            if r != col:
                f = m[r][col] / m[col][col]
                m[r] = [rv - f * cv for rv, cv in zip(m[r], m[col])]
    return [m[i][n] / m[i][i] for i in range(n)]


def _area(pts: Corners) -> float:
    """Shoelace area, as a fraction of the photo."""
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2
