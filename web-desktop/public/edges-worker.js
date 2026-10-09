// Finds a receipt's four corners in a photo, in a Web Worker so OpenCV's start-up and the detection stay
// off the capture page's thread (slow phones). Plain JS in public/ so it can importScripts
// OpenCV (public/vendor, see scripts/copy-vendor.mjs). The page side is src/lib/edges.ts;
// why on the phone at all: docs/adr/0001-receipt-edge-detection-on-the-phone.md.
//
// Receipts are paper: bright and nearly colourless. Edges alone mislead on real photos (hands holding
// the receipt, patterned tables, a receipt filling the frame), so this finds the paper first and fits
// four corners to its outline. Tuned on samples/receipts.

const MIN_AREA = 0.08; // paper smaller than this share of the photo is probably a label, not the receipt
const MAX_AREA = 0.9; // a receipt filling more than this is already cropped
const PAPER_MAX_SATURATION = 60; // of 255: white and grey paper, even under warm light

/** Corners (top-left, top-right, bottom-right, bottom-left, as fractions of the photo) of the receipt in
 * an RGBA Mat, which it frees; null when no clear outline stands out. */
function findCorners(cv, src) {
  const { cols: w, rows: h } = src;
  const mats = [src];
  const track = (m) => (mats.push(m), m);
  try {
    const rgb = track(new cv.Mat());
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.GaussianBlur(rgb, rgb, new cv.Size(5, 5), 0);
    const hsv = track(new cv.Mat());
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    const channels = track(new cv.MatVector());
    cv.split(hsv, channels);
    const sat = track(channels.get(1)), val = track(channels.get(2));

    const side = Math.max(w, h);
    const fill = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(side * 0.03), odd(side * 0.03))));
    const cut = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(side * 0.015), odd(side * 0.015))));

    // Paper = brighter than the scene's own split point (Otsu) and low in colour (skin, wood, cloth aren't).
    const grey = track(new cv.Mat()), bright = track(new cv.Mat()), paper = track(new cv.Mat());
    cv.threshold(sat, grey, PAPER_MAX_SATURATION, 255, cv.THRESH_BINARY_INV);
    cv.threshold(val, bright, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.bitwise_and(bright, grey, paper);
    cv.morphologyEx(paper, paper, cv.MORPH_CLOSE, fill); // fill the printed text in
    cv.morphologyEx(paper, paper, cv.MORPH_OPEN, cut); // cut thin bridges to other bright things

    const contours = track(new cv.MatVector()), hierarchy = track(new cv.Mat());
    cv.findContours(paper, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let blob = null, blobArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = track(contours.get(i));
      const a = cv.contourArea(c);
      if (a > blobArea) [blob, blobArea] = [c, a];
    }
    if (!blob || blobArea < MIN_AREA * w * h) return null;
    // Paper spanning the whole photo, both ways, is a white or grey surface, not the receipt. Splitting
    // it further was tried and cut receipts in half; a crop that's too tight loses line items: no crop.
    const r = cv.boundingRect(blob);
    if (r.width > 0.9 * w && r.height > 0.9 * h) return null;

    const hull = track(new cv.Mat());
    cv.convexHull(blob, hull);
    const hullArea = cv.contourArea(hull);
    let pts = null;
    for (const eps of [0.02, 0.03, 0.04, 0.06, 0.08]) {
      const approx = track(new cv.Mat());
      cv.approxPolyDP(hull, approx, eps * cv.arcLength(hull, true), true);
      if (approx.rows < 4) break;
      if (approx.rows === 4 && cv.contourArea(approx) >= 0.9 * hullArea) {
        pts = Array.from({ length: 4 }, (_, k) => [approx.data32S[k * 2], approx.data32S[k * 2 + 1]]);
        break;
      }
    }
    // Curled or torn paper has no four clean corners: the tightest rotated rectangle around it.
    pts ??= cv.RotatedRect.points(cv.minAreaRect(hull)).map((p) => [p.x, p.y]);

    const corners = order(pts).map(([x, y]) => [clamp(x / w), clamp(y / h)]);
    if (area(corners) > MAX_AREA) return null; // the receipt fills the photo: nothing to crop
    return squarish(corners.map(([x, y]) => [x * w, y * h])) ? corners : null; // else it isn't a receipt's outline
  } catch {
    return null;
  } finally {
    for (const m of mats) m.delete();
  }
}

/** Sorts 4 points into top-left, top-right, bottom-right, bottom-left: clockwise around their
 * centre (y points down), starting from the one nearest the photo's top-left. */
function order(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  const ring = [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const start = ring.reduce((best, p, i) => (p[0] + p[1] < ring[best][0] + ring[best][1] ? i : best), 0);
  return [0, 1, 2, 3].map((k) => ring[(start + k) % 4]);
}

/** Every corner between 60° and 120°: a photographed rectangle, not a sliver or a kite. */
function squarish(pts) {
  return pts.every((p, i) => {
    const a = pts[(i + 3) % 4], b = pts[(i + 1) % 4];
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
    return Math.abs(cos) < 0.5;
  });
}

/** Shoelace area of the corners, as a share of the photo. */
function area(c) {
  return Math.abs(c.reduce((s, [x1, y1], i) => {
    const [x2, y2] = c[(i + 1) % c.length];
    return s + x1 * y2 - x2 * y1;
  }, 0)) / 2;
}

const clamp = (v) => Math.min(1, Math.max(0, v));
const odd = (n) => Math.max(3, Math.round(n) | 1);

if (typeof module === "object") {
  module.exports = { findCorners }; // for trying it on the samples in Node
} else {
  // Protocol: posts {ready: true} or {ready: false} once; then answers each {id, width, height, pixels}
  // (RGBA, transferred) with {id, corners}.
  let cv = null;
  const pending = [];
  const answer = ({ id, width, height, pixels }) => {
    let corners = null;
    try {
      corners = findCorners(cv, cv.matFromImageData(new ImageData(new Uint8ClampedArray(pixels), width, height)));
    } catch {
      // no corners: the photo goes whole
    }
    self.postMessage({ id, corners });
  };
  self.onmessage = (e) => (cv ? answer(e.data) : pending.push(e.data));
  try {
    importScripts("/vendor/opencv.js");
    // `cv` is ready, a thenable that resolves to itself (never hand it to a Promise), or waiting for its runtime.
    const ready = (m) => {
      cv = m;
      self.postMessage({ ready: true });
      pending.splice(0).forEach(answer);
    };
    const c = self.cv;
    if (c.Mat) ready(c);
    else if (typeof c.then === "function") c.then((m) => { delete m.then; ready(m); });
    else c.onRuntimeInitialized = () => ready(c);
  } catch {
    self.postMessage({ ready: false });
  }
}
