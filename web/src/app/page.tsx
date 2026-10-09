"use client";
// Hour-0 skeleton: proves the API, react-query and live events are wired. Simon owns the design.
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, peso } from "@/lib/api";
import { useLiveEvents } from "@/lib/live";
import type { CashAdvance, Company, Health } from "@/lib/types";

export default function Home() {
  const live = useLiveEvents();
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.get<Health>("/api/health"), refetchInterval: 10_000 });
  const company = useQuery({ queryKey: ["company"], queryFn: () => api.get<Company>("/api/company") });
  const advances = useQuery({ queryKey: ["cash-advances"], queryFn: () => api.get<CashAdvance[]>("/api/cash-advances") });

  return (
    <main className="mx-auto w-full max-w-3xl p-4 space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tally</h1>
        <p className="text-sm opacity-70">
          {company.data?.name} · live {live ? "●" : "○"} · model{" "}
          {health.data ? `${health.data.ollama}${health.data.model_loaded ? ", loaded" : ""}` : "…"}
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-medium">Cash Advances</h2>
        <ul className="divide-y rounded border">
          {advances.data?.map((ca) => (
            <li key={ca.id}>
              <Link href={`/liquidations/${ca.liquidation.id}`} className="flex justify-between gap-4 p-3 hover:bg-black/5">
                <span>
                  {ca.employee.name} — {ca.purpose}
                  <span className="block text-sm opacity-70">{ca.released_on} → {ca.spending_end_on} · {ca.liquidation.status}</span>
                </span>
                <span className="text-right">
                  {peso(ca.amount)}
                  <span className="block text-sm opacity-70">return {peso(ca.liquidation.totals.amount_to_return)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
