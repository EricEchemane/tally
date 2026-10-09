"use client";
// Phone capture page, opened from the Liquidation's QR code (SPEC §7). Sits outside the dashboard shell.
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Money, Notice, ReceiptStatusPill, Spinner } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useLiquidation, useReceipt } from "@/lib/queries";

function Capture() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const token = params.get("t") ?? "";
  const liq = useLiquidation(id);
  const { connected } = useLive();
  const [sent, setSent] = useState<number[]>([]);
  const upload = useMutation({
    mutationFn: (files: File[]) =>
      api.upload<{ id: number }[]>(`/api/liquidations/${id}/receipts?t=${encodeURIComponent(token)}`, files),
    onSuccess: (r) => setSent((s) => [...r.map((x) => x.id).reverse(), ...s]),
  });
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) upload.mutate(files);
    e.target.value = "";
  };

  const closed = liq.data && liq.data.status !== "OPEN";
  const forbidden = upload.error instanceof ApiError && upload.error.status === 403;
  const busy = upload.isPending || !!closed;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-accent font-bold text-accent-ink">T</span>
        <div className="min-w-0">
          <h1 className="font-semibold leading-tight">Tally receipt capture</h1>
          <p className="truncate text-sm text-muted">
            {liq.data ? `${liq.data.cash_advance.employee.name} · ${liq.data.cash_advance.purpose}` : "Connecting…"}
          </p>
        </div>
        <span className={`ml-auto size-2.5 shrink-0 rounded-full ${connected ? "bg-ok" : "pulse bg-warn"}`} title={connected ? "Connected" : "Reconnecting"} />
      </header>

      {closed && <Notice tone="warn">This Liquidation is {liq.data!.status.toLowerCase()}. New receipts can’t be added.</Notice>}
      {liq.isError && <Notice tone="bad">Can’t reach Tally. Make sure this phone is on the same Wi-Fi as the computer.</Notice>}

      <div className="grid gap-3">
        <label className={`flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-accent text-accent-ink shadow-card active:scale-[0.99] ${busy ? "pointer-events-none opacity-60" : ""}`}>
          <span className="text-lg font-semibold">📷 Take photo</span>
          <span className="text-sm opacity-80">One receipt per photo, flat and well lit</span>
          <input type="file" accept="image/*" capture="environment" hidden onChange={pick} disabled={busy} />
        </label>
        <label className={`flex h-16 cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-surface text-base font-medium active:scale-[0.99] ${busy ? "pointer-events-none opacity-60" : ""}`}>
          🖼️ Choose from gallery
          <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={busy} />
        </label>
      </div>

      {upload.isPending && <p className="flex items-center justify-center gap-2 text-sm text-muted"><Spinner /> Uploading…</p>}
      {upload.isError && (
        <Notice tone="bad">
          {forbidden ? "This capture link is no longer valid. Scan the QR code on the computer again." : `Upload failed: ${errorMessage(upload.error)}. Try again.`}
        </Notice>
      )}

      {sent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Sent from this phone ({sent.length})</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {sent.map((rid) => <SentReceipt key={rid} id={rid} />)}
          </ul>
        </section>
      )}

      <p className="mt-auto text-center text-xs text-faint">Photos go only to the Tally computer on this network. Nothing is uploaded to the internet.</p>
    </main>
  );
}

function SentReceipt({ id }: { id: number }) {
  const r = useReceipt(id);
  const preview = useLive().previews[id];
  const d = r.data;
  return (
    <li className="enter flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{(d?.effective?.seller_name as string | null) ?? `Receipt #${id}`}</p>
        <p className="truncate font-mono text-xs text-muted">{d?.stage === "done" ? <Money value={d.effective?.total as number | null} /> : preview ?? "Reading…"}</p>
      </div>
      {d && <ReceiptStatusPill status={d.status} stage={d.stage} checksPending={d.checks_pending} />}
    </li>
  );
}

export default function CapturePage() {
  return <Suspense><Capture /></Suspense>;
}
