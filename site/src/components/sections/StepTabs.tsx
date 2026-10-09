"use client";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Step = { title: string; body: ReactNode; visual: ReactNode };

const num = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Desktop: the steps are a numbered pill list (the reference kit's services list) and the visual swaps beside
 * them on a dark panel. Mobile: every step shows its visual inline. Tabs follow the WAI-ARIA pattern.
 */
export function StepTabs({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent) {
    const last = steps.length - 1;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <>
      {/* Mobile and tablet */}
      <ol className="space-y-14 lg:hidden">
        {steps.map((s, i) => (
          <li key={s.title}>
            <p className="flex items-center gap-3 text-xl font-semibold tracking-[-0.02em]">
              <span className="grid size-9 place-items-center rounded-full bg-lime text-sm text-lime-ink">{num(i)}</span>
              {s.title}
            </p>
            <div className="mt-3 max-w-prose text-muted">{s.body}</div>
            <div className="mt-6 rounded-3xl bg-mint p-4 sm:p-6">{s.visual}</div>
          </li>
        ))}
      </ol>

      {/* Desktop */}
      <div className="hidden gap-10 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div role="tablist" aria-label="Steps" aria-orientation="vertical" onKeyDown={onKey} className="flex flex-col gap-3">
            {steps.map((s, i) => {
              const selected = i === active;
              return (
                <button
                  key={s.title}
                  ref={(el) => { tabs.current[i] = el; }}
                  role="tab"
                  id={`step-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="step-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-4 rounded-full border px-6 py-4 text-left transition-colors duration-200 ${
                    selected ? "border-lime bg-lime text-lime-ink" : "border-line-strong hover:border-ink/40"
                  }`}
                >
                  <span className={`text-sm font-semibold ${selected ? "" : "text-muted"}`}>{num(i)}</span>
                  <span className="text-lg font-semibold tracking-[-0.01em]">{s.title}</span>
                  <ArrowUpRightIcon aria-hidden className={`ml-auto size-5 transition-transform duration-200 ${selected ? "rotate-45" : ""}`} />
                </button>
              );
            })}
          </div>
          <p key={active} className="panel-in mt-8 max-w-md text-lg leading-relaxed text-muted">{steps[active].body}</p>
        </div>
        <div
          id="step-panel"
          role="tabpanel"
          aria-labelledby={`step-tab-${active}`}
          className="sticky top-24 self-start rounded-[2rem] bg-mint p-8"
        >
          <div key={active} className="panel-in">{steps[active].visual}</div>
        </div>
      </div>
    </>
  );
}
