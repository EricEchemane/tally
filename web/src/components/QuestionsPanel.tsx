"use client";
// Questions (SPEC §6): asked in English or Taglish, answered by fixed SQL templates. The model only picks
// the question; every number shown here was computed by code.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, peso } from "@/lib/api";
import type { Answer, Question } from "@/lib/types";
import { Button, cx, inputClass, Notice, Spinner } from "./ui";

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
    onSuccess: () => {
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
        className={cx("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ask Tally"
        className={cx(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-line bg-paper shadow-pop transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <div>
            <h2 className="font-semibold">Ask Tally</h2>
            <p className="text-xs text-muted">English or Taglish. Answered on this computer from your records.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {history.isPending && open && <p className="text-sm text-muted">Loading…</p>}
          {count === 0 && !history.isPending && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Try one of these:</p>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => submit(ex)}
                  className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-sm hover:border-accent">
                  {ex}
                </button>
              ))}
            </div>
          )}
          {items.map((q) => <Exchange key={q.id} q={q} onAsk={submit} onNavigate={onClose} />)}
          <div ref={bottom} />
        </div>

        <form
          className="border-t border-line bg-surface p-3"
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
            <Button type="submit" variant="primary" busy={ask.isPending} disabled={!text.trim()}>Ask</Button>
          </div>
          {count > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => submit(ex)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-ink">
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

function Exchange({ q, onAsk, onNavigate }: { q: Question; onAsk: (t: string) => void; onNavigate: () => void }) {
  return (
    <div className="enter space-y-2">
      <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm text-accent-ink">{q.text}</p>
      <div className="max-w-[95%] rounded-lg rounded-bl-sm border border-line bg-surface px-3 py-2.5 text-sm">
        {q.state !== "done" || !q.answer ? (
          <p className="flex items-center gap-2 text-muted">
            <Spinner />
            {q.state === "queued" ? "Waiting for the local model…" : "Working it out…"}
          </p>
        ) : (
          <AnswerView a={q.answer} onAsk={onAsk} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

function AnswerView({ a, onAsk, onNavigate }: { a: Answer; onAsk: (t: string) => void; onNavigate: () => void }) {
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
  if (a.kind === "reply") {
    return (
      <div className="space-y-2">
        <p className="font-medium">{a.sentence}</p>
        {a.body.map((p) => <p key={p}>{p}</p>)}
        {a.suggestions.length > 0 && (
          <ul className="space-y-1">
            {a.suggestions.map((s) => (
              <li key={s}>
                <button type="button" className="text-left text-accent hover:underline" onClick={() => onAsk(s)}>{s}</button>
              </li>
            ))}
          </ul>
        )}
        {a.note && <p className="text-xs text-muted">{a.note}</p>}
      </div>
    );
  }
  const { columns, rows } = a.table;
  return (
    <div className="space-y-3">
      <p className="font-medium">{a.sentence}</p>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead className="bg-sunken text-left text-muted">
              <tr>{columns.map((c) => <th key={c} className={cx("px-2 py-1.5 font-medium", MONEY_COLUMNS.has(c) && "text-right")}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={cx("px-2 py-1.5", (MONEY_COLUMNS.has(columns[j]) || typeof cell === "number") && "num text-right")}>
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
        <div className="flex flex-wrap gap-1.5">
          {a.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} onClick={onNavigate}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs text-accent hover:border-accent">
              {l.label} →
            </Link>
          ))}
        </div>
      )}
      <p className="border-t border-line pt-2 text-xs text-muted">
        <span className="font-medium">How I got this:</span> matched “{a.how.question}”
        {a.how.period ? `, period ${a.how.period.from} to ${a.how.period.to}` : ", all dates"}. Figures computed from your records, not by the model.
      </p>
    </div>
  );
}
