"use client";
// Phone capture page, opened from the Liquidation's QR code (SPEC §7). Sits outside the dashboard shell.
// One-handed: context at the top, what was sent in the middle, the capture actions pinned in thumb reach.
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CropReview, type Draft } from "@/components/CropReview";
import { cx, Money, Notice, ReceiptStatusPill, Spinner } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { type Corners, detectCorners, isWholePhoto, startDetector } from "@/lib/edges";
import { formatDate, STAGE } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useLiquidation, useReceipt } from "@/lib/queries";

const CameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8.5h3l2-3h6l2 3h3v10.5H4z" /><circle cx="12" cy="13.5" r="3.5" />
  </svg>
);
const GalleryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-4.5-4.5L7 19.5" />
  </svg>
);
const CheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

const TIPS = [
  "One receipt per photo",
  "Lay it flat, in good light",
  "Keep the whole receipt in the frame, top to bottom",
];

function Capture() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const token = params.get("t") ?? "";
  const liq = useLiquidation(id);
  const { connected } = useLive();
  const [sent, setSent] = useState<number[]>([]);
  const [justSent, setJustSent] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const batch = useRef(0); // a cancelled batch's detection results are dropped
  const upload = useMutation({
    mutationFn: (ds: Draft[]) =>
      api.upload<{ id: number }[]>(`/api/liquidations/${id}/receipts?t=${encodeURIComponent(token)}`, ds.map((d) => d.file), {
        corners: JSON.stringify(ds.map((d) => (d.corners && !isWholePhoto(d.corners) ? round(d.corners) : null))),
      }),
    onSuccess: (r) => {
      setSent((s) => [...r.map((x) => x.id).reverse(), ...s]);
      setJustSent(r.length);
      closeReview();
    },
  });
  // The edge finder is ~10 MB: start fetching it now so it's ready by the time a photo is taken.
  useEffect(() => void startDetector(), []);
  // The "sent" confirmation fades after a moment; the list below keeps the record.
  useEffect(() => {
    if (!justSent) return;
    const t = setTimeout(() => setJustSent(0), 2500);
    return () => clearTimeout(t);
  }, [justSent]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    upload.reset();
    const n = ++batch.current;
    const ds: Draft[] = files.map((file, i) => ({
      key: `${n}-${i}`, file, url: URL.createObjectURL(file), state: "finding", detected: null, corners: null,
    }));
    setDrafts(ds);
    findEdges(ds, n);
  };

  const patch = (key: string, p: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...p } : d)));

  // One photo at a time: full-size phone photos are heavy to decode.
  const findEdges = async (ds: Draft[], n: number) => {
    for (const d of ds) {
      if (batch.current !== n) return;
      const { readable, corners } = await detectCorners(d.file);
      if (batch.current !== n) return;
      patch(d.key, { state: !readable ? "unreadable" : corners ? "found" : "none", detected: corners, corners });
    }
  };

  const closeReview = () => {
    batch.current++;
    setDrafts((ds) => {
      ds.forEach((d) => URL.revokeObjectURL(d.url));
      return [];
    });
  };

  const ca = liq.data?.cash_advance;
  const closed = liq.data && liq.data.status !== "OPEN";
  const forbidden = upload.error instanceof ApiError && upload.error.status === 403;
  const busy = upload.isPending || !!closed || !liq.data;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex flex-1 flex-col gap-6 px-4 pb-40 pt-4">
        {/* Who and what this phone is scanning for */}
        <header className="flex items-center gap-3 rounded-full border border-line bg-surface py-2 pl-2 pr-4 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img src="/logo.png" alt="" className="size-10 shrink-0" />
          <span className="text-sm font-semibold">Tally</span>
          <span className={cx("ml-auto flex items-center gap-1.5 text-xs", connected ? "text-muted" : "text-warn")}>
            <span className={cx("size-2 rounded-full", connected ? "bg-ok" : "pulse bg-warn")} />
            {connected ? "Connected" : "Reconnecting…"}
          </span>
        </header>

        <section className="rounded-3xl border border-line bg-surface p-6">
          {ca ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Scanning receipts for</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{ca.employee.name}</h1>
              <p className="mt-1 text-sm text-muted">{ca.purpose}</p>
              <p className="mt-4 inline-flex rounded-full bg-sunken px-3 py-1 text-xs text-muted">
                {formatDate(ca.released_on)} – {formatDate(ca.spending_end_on)}
              </p>
            </>
          ) : liq.isError ? (
            <h1 className="text-base font-semibold">Can’t reach Tally</h1>
          ) : (
            <div className="space-y-3"><div className="pulse h-3 w-32 rounded-full bg-sunken" /><div className="pulse h-7 w-48 rounded-full bg-sunken" /></div>
          )}
        </section>

        {closed && <Notice tone="warn">This Liquidation is {liq.data!.status.toLowerCase()}. New receipts can’t be added.</Notice>}
        {liq.isError && <Notice tone="bad">Make sure this phone is on the same Wi-Fi as the Tally computer, then scan the QR code again.</Notice>}
        {upload.isError && (
          <Notice tone="bad">
            {forbidden ? "This capture link is no longer valid. Scan the QR code on the computer again." : `Upload failed: ${errorMessage(upload.error)}. Try again.`}
          </Notice>
        )}

        {sent.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-line-strong p-6">
            <h2 className="text-base font-semibold">For a clean read</h2>
            <ul className="mt-4 space-y-3">
              {TIPS.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><CheckIcon className="size-3.5" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="flex items-baseline justify-between px-2 text-base font-semibold">
              Sent from this phone
              <span className="text-sm font-normal text-muted">{sent.length}</span>
            </h2>
            <ul className="space-y-1 overflow-hidden rounded-3xl border border-line bg-surface p-2">
              {sent.map((rid) => <SentReceipt key={rid} id={rid} />)}
            </ul>
            <p className="px-2 text-xs text-muted">The computer reads and checks each one. Results show here as they finish.</p>
          </section>
        )}

        <p className="mt-auto text-center text-xs text-faint">Photos go only to the Tally computer on this network. Nothing is uploaded to the internet.</p>
      </main>

      {drafts.length > 0 && (
        <CropReview drafts={drafts} sending={upload.isPending} onCancel={closeReview}
          error={upload.isError ? (forbidden ? "This capture link is no longer valid. Scan the QR code on the computer again." : `Upload failed: ${errorMessage(upload.error)}. Try again.`) : undefined}
          onCorners={(key, corners) => patch(key, { corners })} onSend={() => upload.mutate(drafts)} />
      )}

      {/* Capture actions, pinned in thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-linear-to-t from-paper from-70% to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md space-y-3">
          <div aria-live="polite" className="flex justify-center">
            {upload.isPending ? (
              <span className="enter inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm shadow-card"><Spinner /> Sending…</span>
            ) : justSent ? (
              <span className="enter inline-flex items-center gap-2 rounded-full border border-ok/25 bg-ok-soft px-4 py-1.5 text-sm text-ok shadow-card">
                <CheckIcon className="size-4" /> Sent {justSent} photo{justSent === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="flex gap-3">
            <label className={cx("flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-base font-semibold text-accent-ink shadow-pop transition-transform active:scale-[0.98]",
              busy && "pointer-events-none opacity-50")}>
              <CameraIcon className="size-5" />
              {sent.length ? "Take another" : "Take photo"}
              <input type="file" accept="image/*" capture="environment" hidden onChange={pick} disabled={busy} />
            </label>
            <label aria-label="Choose from gallery" title="Choose from gallery"
              className={cx("grid size-14 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-surface text-ink shadow-card transition-transform active:scale-[0.98]",
                busy && "pointer-events-none opacity-50")}>
              <GalleryIcon className="size-5" />
              <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={busy} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

const round = (c: Corners) => c.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

function SentReceipt({ id }: { id: number }) {
  const r = useReceipt(id);
  const preview = useLive().previews[id];
  const d = r.data;
  const name = (d?.effective?.seller_name as string | null) ?? null;
  return (
    <li className="enter flex items-center gap-3 rounded-2xl p-2">
      {d ? (
        // eslint-disable-next-line @next/next/no-img-element -- local API image, no optimizer offline
        <img src={d.cropped_image_url ?? d.image_url} alt="" className="size-12 shrink-0 rounded-2xl border border-line bg-sunken object-cover" />
      ) : <div className="pulse size-12 shrink-0 rounded-2xl bg-sunken" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name ?? (d && d.stage !== "done" ? STAGE[d.stage] + "…" : `Receipt #${id}`)}</p>
        <p className="truncate text-xs text-muted">
          {d?.stage === "done" ? <Money value={d.effective?.total as number | null} /> : <span className="font-mono">{preview ?? "Waiting for the computer"}</span>}
        </p>
      </div>
      {d && <ReceiptStatusPill status={d.status} stage={d.stage} checksPending={d.checks_pending} />}
    </li>
  );
}

export default function CapturePage() {
  return <Suspense><Capture /></Suspense>;
}
