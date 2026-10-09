"use client";
// The phone's "check the edges" step between taking photos and sending them: each photo shows the
// receipt outline found on the phone, with corners to drag. Sending is never blocked: a photo still
// being looked at, or one with no outline, goes as the whole photo.
import { useRef, useState } from "react";
import { Button, cx, Notice, Spinner } from "@/components/ui";
import { type Corners, WHOLE_PHOTO } from "@/lib/edges";

export interface Draft {
  key: string;
  file: File;
  url: string; // object URL for the preview
  state: "finding" | "found" | "none" | "unreadable";
  detected: Corners | null; // what the phone found, for "Reset"
  corners: Corners | null; // what will be sent; null = the whole photo
}

export function CropReview({ drafts, onCorners, onSend, onCancel, sending, error }: {
  drafts: Draft[];
  onCorners: (key: string, corners: Corners | null) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  error?: string;
}) {
  const [selected, setSelected] = useState(drafts[0]?.key);
  const d = drafts.find((x) => x.key === selected) ?? drafts[0];
  if (!d) return null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-paper">
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Check the edges</h1>
          <p className="text-sm text-muted">{HINT[d.state]}</p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={sending}>Cancel</Button>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 px-4 py-3">
        <div className="grid min-h-0 flex-1 place-items-center">
          {d.state === "unreadable" ? (
            <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              This phone can’t preview {d.file.name || "this photo"}. It will be sent as is.
            </p>
          ) : (
            <CornerEditor key={d.key} draft={d} onCorners={(c) => onCorners(d.key, c)} />
          )}
        </div>

        <div className="flex justify-center gap-2">
          <Button size="sm" variant={d.corners ? "secondary" : "primary"} disabled={!d.corners || sending}
            onClick={() => onCorners(d.key, null)}>Use whole photo</Button>
          {d.detected && (
            <Button size="sm" disabled={d.corners === d.detected || sending} onClick={() => onCorners(d.key, d.detected)}>
              Reset edges
            </Button>
          )}
        </div>

        {drafts.length > 1 && (
          <ul className="flex shrink-0 gap-2 overflow-x-auto pb-1">
            {drafts.map((x, i) => (
              <li key={x.key}>
                <button type="button" onClick={() => setSelected(x.key)} aria-label={`Photo ${i + 1}`}
                  className={cx("relative block size-16 overflow-hidden rounded-2xl border-2 bg-sunken",
                    x.key === d.key ? "border-accent" : "border-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img src={x.url} alt="" className="size-full object-fill" />
                  {x.corners && <Outline corners={x.corners} thin />}
                  {x.state === "finding" && <span className="absolute inset-0 grid place-items-center bg-paper/60"><Spinner /></span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <Notice tone="bad">{error}</Notice>}
        <Button variant="primary" busy={sending} onClick={onSend} className="h-14 w-full text-base shadow-pop">
          Send {drafts.length} photo{drafts.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}

const HINT: Record<Draft["state"], string> = {
  finding: "Looking for the receipt’s edges…",
  found: "Drag a corner if the outline is off.",
  none: "No clear edges found. Drag the corners to crop, or send the whole photo.",
  unreadable: "No preview for this photo.",
};

/** The photo with the outline and four draggable corners. Coordinates are fractions of the photo. */
function CornerEditor({ draft, onCorners }: { draft: Draft; onCorners: (c: Corners) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const corners = draft.corners ?? WHOLE_PHOTO;

  const drag = (i: number) => (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const next = corners.map((p) => [...p]) as Corners;
    next[i] = [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
    onCorners(next);
  };

  return (
    <div ref={box} className="relative max-h-full touch-none select-none">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img src={draft.url} alt="Receipt photo" draggable={false} className="block max-h-[calc(100dvh-16rem)] max-w-full rounded-2xl" />
      <Outline corners={corners} />
      {corners.map(([x, y], i) => (
        <span key={i} title={CORNER_NAMES[i]}
          className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(i)(e)}>
          <span className="size-5 rounded-full border-2 border-white bg-accent shadow-pop" />
        </span>
      ))}
    </div>
  );
}

const CORNER_NAMES = ["Top-left corner", "Top-right corner", "Bottom-right corner", "Bottom-left corner"];

/** Dims everything outside the receipt and draws its outline. */
function Outline({ corners, thin }: { corners: Corners; thin?: boolean }) {
  const pts = corners.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-0 size-full">
      <path d={`M0,0H100V100H0Z M${pts.replaceAll(" ", " L")}Z`} fillRule="evenodd" className="fill-black/45" />
      <polygon points={pts} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={thin ? 1.5 : 2.5}
        strokeLinejoin="round" className="stroke-accent" />
    </svg>
  );
}
