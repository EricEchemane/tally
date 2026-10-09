// Finds a receipt's four corners in a photo, on the phone, before upload
// (docs/adr/0001-receipt-edge-detection-on-the-phone.md). The work happens in public/edges-worker.js, off
// the page's thread, so a slow phone starting OpenCV never stalls the capture page. Detection is a nicety and never
// blocks an upload: anything that goes wrong means "no corners", and the whole photo is sent.

/** Top-left, top-right, bottom-right, bottom-left, as fractions (0–1) of the upright photo. */
export type Corners = [number, number][];

export const WHOLE_PHOTO: Corners = [[0, 0], [1, 0], [1, 1], [0, 1]];

const WORK_SIDE = 800; // corners are found on a small copy: fast on a phone, and enough for 4 points
const READY_TIMEOUT = 30_000; // ~10 MB to download from the Tally computer, then OpenCV's start-up

let worker: Promise<Worker | null> | null = null;
let nextId = 0;

/** Starts the detector (once). Call early: the capture page does on open, so it's ready by the first photo. */
export function startDetector(): Promise<Worker | null> {
  worker ??= new Promise((resolve) => {
    let w: Worker;
    try {
      w = new Worker("/edges-worker.js");
    } catch {
      return resolve(null);
    }
    const timer = setTimeout(() => resolve(null), READY_TIMEOUT);
    w.addEventListener("message", function onReady(e: MessageEvent) {
      if (!("ready" in e.data)) return;
      w.removeEventListener("message", onReady);
      clearTimeout(timer);
      resolve(e.data.ready ? w : null);
    });
    w.addEventListener("error", () => resolve(null));
  });
  return worker;
}

/** The receipt's corners in a photo, or null when the detector isn't available, the browser can't
 * decode the file (e.g. HEIC outside Safari), or no clear outline stands out. */
export async function detectCorners(file: File): Promise<{ readable: boolean; corners: Corners | null }> {
  const pixels = await decode(file);
  if (!pixels) return { readable: false, corners: null };
  const w = await startDetector();
  if (!w) return { readable: true, corners: null };
  const id = ++nextId;
  const corners = await new Promise<Corners | null>((resolve) => {
    const timer = setTimeout(() => done(null), 15_000);
    function done(c: Corners | null) {
      clearTimeout(timer);
      w!.removeEventListener("message", onAnswer);
      resolve(c);
    }
    function onAnswer(e: MessageEvent) {
      if (e.data.id === id) done(e.data.corners);
    }
    w!.addEventListener("message", onAnswer);
    w!.postMessage({ id, width: pixels.width, height: pixels.height, pixels: pixels.data.buffer }, [pixels.data.buffer]);
  });
  return { readable: true, corners };
}

/** The photo upright (browsers apply EXIF orientation) and shrunk, as RGBA pixels. */
async function decode(file: File): Promise<ImageData | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, WORK_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** True when the corners are the whole photo, i.e. nothing to crop. */
export const isWholePhoto = (c: Corners) =>
  c.every(([x, y], i) => Math.abs(x - WHOLE_PHOTO[i][0]) < 0.005 && Math.abs(y - WHOLE_PHOTO[i][1]) < 0.005);
