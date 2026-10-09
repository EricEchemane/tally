"use client";
// Hour-0 skeleton of the Liquidation screen. Simon owns the design (SPEC §9).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api, ApiError, peso } from "@/lib/api";
import { useLiveEvents } from "@/lib/live";
import type { Company, Liquidation } from "@/lib/types";
import { Suspense } from "react";

function LiquidationView() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  useLiveEvents();
  const liq = useQuery({ queryKey: ["liquidation", Number(id)], queryFn: () => api.get<Liquidation>(`/api/liquidations/${id}`) });
  const company = useQuery({ queryKey: ["company"], queryFn: () => api.get<Company>("/api/company") });
  const link = useQuery({ queryKey: ["capture-link", Number(id)], queryFn: () => api.get<{ url: string; qr_svg: string }>(`/api/liquidations/${id}/capture-link`) });

  const upload = useMutation({ mutationFn: (files: FileList) => api.upload(`/api/liquidations/${id}/receipts`, files) });
  const approve = useMutation({
    mutationFn: () => api.post(`/api/liquidations/${id}/approve`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["liquidation", Number(id)] }),
  });
  const toggleRule = useMutation({
    mutationFn: () => api.patch("/api/company", {
      buyer_details_rule: company.data?.buyer_details_rule === "ALL_RECEIPTS" ? "AT_1000_AND_ABOVE" : "ALL_RECEIPTS",
    }),
  });

  if (!liq.data) return <main className="p-4">Loading…</main>;
  const { cash_advance: ca, totals } = liq.data;

  return (
    <main className="mx-auto w-full max-w-3xl p-4 space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{ca.employee.name} — {ca.purpose}</h1>
        <p className="text-sm opacity-70">{liq.data.status} · {ca.released_on} → {ca.spending_end_on}</p>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(totals).map(([k, v]) => (
          <div key={k} className="rounded border p-2">
            <dt className="text-xs opacity-70">{k.replaceAll("_", " ")}</dt>
            <dd className="font-medium">{peso(v)}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-wrap items-center gap-3">
        <button className="rounded border px-3 py-1" onClick={() => approve.mutate()}>Approve</button>
        {approve.error instanceof ApiError && <span className="text-sm text-red-600">Blocked: {JSON.stringify(approve.error.body)}</span>}
        <button className="rounded border px-3 py-1" onClick={() => toggleRule.mutate()}>
          Buyer details: {company.data?.buyer_details_rule}
        </button>
        <label className="rounded border px-3 py-1 cursor-pointer">
          Upload receipts
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
        </label>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Receipts ({liq.data.open_needs_review} need review)</h2>
        <ul className="divide-y rounded border">
          {liq.data.receipts.map((r) => (
            <li key={r.id} className="flex justify-between gap-4 p-3">
              <span>{r.seller_name ?? `Receipt #${r.id}`}<span className="block text-sm opacity-70">{r.date ?? "—"} · {r.stage}</span></span>
              <span className="text-right">{peso(r.total)}<span className="block text-sm">{r.checks_pending ? "checks pending" : r.status ?? "…"} · {r.open_findings} open</span></span>
            </li>
          ))}
        </ul>
      </section>

      {link.data && (
        <section className="space-y-2">
          <h2 className="font-medium">Scan to capture with your phone</h2>
          <div className="w-48 bg-white p-2" dangerouslySetInnerHTML={{ __html: link.data.qr_svg }} />
          <p className="break-all text-xs opacity-70">{link.data.url}</p>
        </section>
      )}
    </main>
  );
}

export default function LiquidationPage() {
  return <Suspense><LiquidationView /></Suspense>;
}
