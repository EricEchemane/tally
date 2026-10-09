"use client";
import { PaperPlaneRightIcon, SparkleIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { AppWindow, Money, SampleNote } from "@/components/product";

const ANSWER = [
  { employee: "Juan", liquidation: "Store visits, April", amount: 484.05 },
  { employee: "Maria", liquidation: "Pharmacy run, September", amount: 1215.5 },
];

const SUGGESTIONS = ["How much input VAT did we lose in April?", "Has any receipt been submitted twice?"];

/**
 * A short conversation that plays once, the first time it scrolls into view: question, answer, then how the answer
 * was worked out. Without JavaScript or with reduced motion the whole conversation simply shows.
 */
export function AssistantChat() {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"still" | "armed" | "play">("still");

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPhase("armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("play");
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className={phase === "armed" ? "chat-armed" : phase === "play" ? "chat-play" : undefined}>
      <AppWindow title="Assistant">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <SparkleIcon aria-hidden weight="fill" className="size-3.5 text-accent" />
            Tally Assistant
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">
            <WifiSlashIcon aria-hidden className="size-3.5" />
            Offline, on this laptop
          </span>
        </div>

        <div className="space-y-4 px-4 py-5 text-sm sm:px-5">
          <p className="chat-step ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-lime px-4 py-2.5 font-medium text-lime-ink" style={{ "--d": "0ms" } as React.CSSProperties}>
            Who still needs to return money?
          </p>

          <div className="chat-step max-w-[95%] rounded-2xl rounded-bl-md bg-sunken px-4 py-3" style={{ "--d": "700ms" } as React.CSSProperties}>
            <p>Two employees still need to return money.</p>
            <table className="mt-3 w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-1.5 font-medium">Employee</th>
                  <th className="pb-1.5 font-medium">Liquidation</th>
                  <th className="pb-1.5 text-right font-medium">To return</th>
                </tr>
              </thead>
              <tbody>
                {ANSWER.map((r) => (
                  <tr key={r.employee} className="border-t border-line">
                    <td className="py-2">{r.employee}</td>
                    <td className="py-2 pr-2 text-muted">{r.liquidation}</td>
                    <td className="py-2 text-right"><Money value={r.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="chat-step max-w-[95%] pl-1 text-xs text-muted" style={{ "--d": "1400ms" } as React.CSSProperties}>
            How I got this: each cash advance minus what was validly spent, from your own records.
          </p>
        </div>

        <div className="border-t border-line px-4 py-3 sm:px-5">
          <ul className="mb-3 flex flex-wrap gap-2 text-xs">
            {SUGGESTIONS.map((q) => (
              <li key={q} className="rounded-full border border-line bg-paper px-3 py-1.5 text-muted">{q}</li>
            ))}
          </ul>
          <div aria-hidden className="flex items-center justify-between rounded-full border border-line bg-paper py-2 pr-2 pl-4 text-sm text-faint">
            Ask about your Liquidations
            <span className="grid size-8 place-items-center rounded-full bg-lime text-lime-ink">
              <PaperPlaneRightIcon weight="fill" className="size-4" />
            </span>
          </div>
        </div>
      </AppWindow>
      <div className="mt-4"><SampleNote /></div>
    </div>
  );
}
