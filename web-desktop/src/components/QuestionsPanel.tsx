"use client";
// Questions (SPEC §6): asked in English or Taglish, answered by fixed SQL templates. The model only picks
// the question; every number shown here was computed by code.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, peso } from "@/lib/api";
import { pageHref } from "@/lib/routes";
import type { Answer, Question } from "@/lib/types";
import { Button, cx, inputClass, Notice, Sparkle, Spinner } from "./ui";

const EXAMPLES = [
  "How much input VAT did we lose in April?",
  "Magkano ang gastos per category this quarter?",
  "Which receipts were submitted twice?",
  "Ano pa ang kailangan kong i-review?",
];

// Answer table columns that hold peso amounts (formatting only, never arithmetic).
const MONEY_COLUMNS = new Set(["VAT", "Amount", "Spend", "Advance", "Valid Spend", "Amount to Return"]);

export function QuestionsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  // Questions asked in this session get the animated reveal; history shown on open doesn't.
  const [asked, setAsked] = useState<number[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ["questions"],
    queryFn: () => api.get<Question[]>("/api/questions"),
    enabled: open,
    // The socket's question.answered is the main signal; polling covers a dropped socket.
    refetchInterval: (q) => (q.state.data?.some((x) => x.state !== "done") ? 3_000 : false),
  });

  const ask = useMutation({
    mutationFn: (t: string) => api.post<{ question_id: number }>("/api/questions", { text: t }),
    onSuccess: (r) => {
      setAsked((ids) => [...ids, r.question_id]);
      setText("");
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = [...(history.data ?? [])].reverse(); // oldest first, like a chat
  const count = items.length;
  const lastState = items.at(-1)?.state;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count, lastState]);

  const submit = (t: string) => {
    const q = t.trim();
    if (q && !ask.isPending) ask.mutate(q);
  };

  return (
    <div className={cx("fixed inset-0 z-40", !open && "pointer-events-none")} inert={!open}>
      <div
        className={cx("absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ask Tally"
        className={cx(
          "ask-panel absolute inset-y-2 right-2 flex w-[calc(100%-1rem)] max-w-xl origin-right flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-pop",
          open ? "translate-x-0 scale-100 opacity-100" : "translate-x-[calc(100%+1rem)] scale-[0.97] opacity-0",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="ask-button grid size-9 shrink-0 place-items-center rounded-full text-white"><Sparkle className="twinkle size-5" /></span>
            <div>
              <h2 className="text-base font-semibold">Ask Tally</h2>
              <p className="text-xs text-muted">English or Taglish. Answered on this computer from your records.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {history.isPending && open && <p className="text-sm text-muted">Loading…</p>}
          {count === 0 && !history.isPending && (
            <div className="space-y-6 pt-6">
              <div className="space-y-2 text-center">
                <span className="ask-button mx-auto grid size-14 place-items-center rounded-full text-white"><Sparkle className="twinkle size-8" /></span>
                <p className="text-xl font-semibold tracking-tight">What do you want to know?</p>
                <p className="text-sm text-muted">Ask about your Cash Advances, receipts and lost input VAT.</p>
              </div>
              {/* key: the chips float in again every time the panel opens */}
              <div key={String(open)} className="stagger space-y-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => submit(ex)}
                    className="group flex w-full items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 py-2.5 text-left text-sm transition-[border-color,transform,background-color] duration-150 hover:-translate-y-px hover:border-accent/50 hover:bg-accent-soft/40">
                    {ex}
                    <span aria-hidden className="text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.map((q) => <Exchange key={q.id} q={q} fresh={asked.includes(q.id)} onAsk={submit} onNavigate={onClose} />)}
          <div ref={bottom} />
        </div>

        <form
          className="border-t border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          {ask.isError && <Notice tone="bad" className="mb-2">{errorMessage(ask.error)}</Notice>}
          <div className="flex gap-2">
            <input
              ref={input}
              className={inputClass}
              placeholder="e.g. How much input VAT did we lose in April?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
            />
            <button type="submit" disabled={!text.trim() || ask.isPending} aria-label="Ask"
              className={cx("grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-95",
                text.trim() ? "ask-button text-white hover:-translate-y-px" : "border border-line bg-sunken text-faint")}>
              {ask.isPending ? <Spinner /> : (
                <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
                </svg>
              )}
            </button>
          </div>
          {count > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => submit(ex)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors duration-150 hover:border-accent/50 hover:bg-sunken hover:text-ink">
                  {ex}
                </button>
              ))}
            </div>
          )}
        </form>
      </aside>
    </div>
  );
}

const THINKING = ["Reading your records…", "Matching your question…", "Checking the numbers…"];

function Thinking({ queued }: { queued: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (queued) return;
    const t = setInterval(() => setI((x) => (x + 1) % THINKING.length), 1300);
    return () => clearInterval(t);
  }, [queued]);
  return (
    <div className="space-y-2.5 py-0.5">
      <p key={queued ? "q" : i} className="enter flex items-center gap-2 text-muted">
        <Sparkle className="twinkle size-4 text-accent" />
        {queued ? "Waiting for the AI…" : THINKING[i]}
      </p>
      <div className="thinking-track" />
    </div>
  );
}

function Exchange({ q, fresh, onAsk, onNavigate }: { q: Question; fresh: boolean; onAsk: (t: string) => void; onNavigate: () => void }) {
  return (
    <div className="enter space-y-2">
      <p className="ask-button ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-sm text-white">{q.text}</p>
      <div className="max-w-[95%] rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3 text-sm">
        {q.state !== "done" || !q.answer ? (
          <Thinking queued={q.state === "queued"} />
        ) : (
          <AnswerView a={q.answer} onAsk={onAsk} onNavigate={onNavigate} reveal={fresh} />
        )}
      </div>
    </div>
  );
}

/** The sentence, word by word when `reveal`; peso amounts stand out either way. */
function Sentence({ text, reveal }: { text: string; reveal: boolean }) {
  const parts = text.split(/(\s+)/);
  let w = 0;
  return (
    <p className="font-medium leading-relaxed">
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const money = /^₱[\d,]+(\.\d+)?[.,:;]?$/.test(part);
        const delay = Math.min(w++ * 28, 700);
        return (
          <span key={i} className={cx(reveal && "word-in", money && "rounded-md bg-accent-soft px-1 text-accent")}
            style={reveal ? { animationDelay: `${delay}ms` } : undefined}>
            {part}
          </span>
        );
      })}
    </p>
  );
}

function AnswerView({ a, onAsk, onNavigate, reveal }: { a: Answer; onAsk: (t: string) => void; onNavigate: () => void; reveal: boolean }) {
  if (a.kind === "clarify") {
    return (
      <div className="space-y-2">
        <p>{a.sentence}</p>
        <div className="flex flex-wrap gap-2">
          {a.choices.map((c) => (
            <Button key={c.label} size="sm" onClick={() => onAsk(c.text)}>{c.label}</Button>
          ))}
        </div>
      </div>
    );
  }
  if (a.kind === "unsupported") {
    return (
      <div className="space-y-2">
        <p>{a.sentence}</p>
        <ul className="space-y-1">
          {a.supported.map((s) => (
            <li key={s}>
              <button type="button" className="text-left text-accent hover:underline" onClick={() => onAsk(s)}>{s}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const { columns, rows } = a.table;
  const words = a.sentence.split(/\s+/).length;
  const after = reveal ? { animationDelay: `${Math.min(words * 28, 700) + 150}ms` } : undefined;
  return (
    <div className="space-y-3">
      <Sentence text={a.sentence} reveal={reveal} />
      {rows.length > 0 && (
        <div className={cx("overflow-x-auto rounded-2xl border border-line", reveal && "after-words")} style={after}>
          <table className="w-full text-xs">
            <thead className="bg-sunken text-left text-muted">
              <tr>{columns.map((c) => <th key={c} className={cx("px-3 py-2 font-medium", MONEY_COLUMNS.has(c) && "text-right")}>{c}</th>)}</tr>
            </thead>
            <tbody className={cx("divide-y divide-line", reveal && "stagger")}>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={cx("px-3 py-2", (MONEY_COLUMNS.has(columns[j]) || typeof cell === "number") && "num text-right")}>
                      {cell == null ? "—" : MONEY_COLUMNS.has(columns[j]) && typeof cell === "number" ? peso(cell) : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a.links.length > 0 && (
        <div className={cx("flex flex-wrap gap-1.5", reveal && "after-words")} style={after}>
          {a.links.map((l) => (
            <Link key={l.href + l.label} href={pageHref(l.href)} onClick={onNavigate}
              className="rounded-full border border-line px-3 py-1 text-xs text-accent transition-colors duration-150 hover:border-accent/50 hover:bg-accent-soft/40">
              {l.label} →
            </Link>
          ))}
        </div>
      )}
      <p className={cx("border-t border-line pt-2 text-xs text-muted", reveal && "after-words")} style={after}>
        <span className="font-medium">How I got this:</span> matched “{a.how.question}”
        {a.how.period ? `, period ${a.how.period.from} to ${a.how.period.to}` : ", all dates"}. Figures computed from your records, not by the model.
      </p>
    </div>
  );
}
