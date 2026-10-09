"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type { LiveEvent, Stage } from "./types";

type Queue = Extract<LiveEvent, { event: "queue.updated" }>;

interface LiveState {
  connected: boolean;
  /** First OCR rows per receipt, shown while the model extracts (receipt.ocr_done). */
  previews: Record<number, string>;
  /** Latest stage and queue position per receipt (receipt.stage). */
  stages: Record<number, { stage: Stage; queue_position: number }>;
  queue: Pick<Queue, "length" | "current"> | null;
}

const LiveContext = createContext<LiveState>({ connected: false, previews: {}, stages: {}, queue: null });

/** One socket for the whole app. Events are hints: invalidate, then react-query refetches via REST. */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>({ connected: false, previews: {}, stages: {}, queue: null });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => {
        setState((s) => ({ ...s, connected: true }));
        qc.invalidateQueries(); // no replay: refetch everything on (re)connect
      };
      socket.onclose = () => {
        setState((s) => ({ ...s, connected: false }));
        if (!closed) retry = setTimeout(open, 1000);
      };
      socket.onmessage = (msg) => {
        const e = JSON.parse(msg.data) as LiveEvent;
        switch (e.event) {
          case "receipt.stage":
            setState((s) => ({ ...s, stages: { ...s.stages, [e.receipt_id]: { stage: e.stage, queue_position: e.queue_position } } }));
            qc.invalidateQueries({ queryKey: ["receipt", e.receipt_id] });
            qc.invalidateQueries({ queryKey: ["liquidation", e.liquidation_id] });
            qc.invalidateQueries({ queryKey: ["cash-advances"] }); // the list's "Next step" shows reading/review counts
            break;
          case "receipt.ocr_done":
            setState((s) => ({ ...s, previews: { ...s.previews, [e.receipt_id]: e.preview } }));
            break;
          case "receipt.updated":
            qc.invalidateQueries({ queryKey: ["receipt", e.receipt_id] });
            qc.invalidateQueries({ queryKey: ["liquidation", e.liquidation_id] });
            qc.invalidateQueries({ queryKey: ["cash-advances"] });
            qc.invalidateQueries({ queryKey: ["overview"] });
            break;
          case "receipt.failed":
            qc.invalidateQueries({ queryKey: ["receipt", e.receipt_id] });
            qc.invalidateQueries({ queryKey: ["liquidation"] });
            break;
          case "liquidation.updated":
            qc.invalidateQueries({ queryKey: ["liquidation", e.liquidation_id] });
            qc.invalidateQueries({ queryKey: ["cash-advances"] });
            qc.invalidateQueries({ queryKey: ["overview"] });
            break;
          case "question.answered":
            qc.invalidateQueries({ queryKey: ["question", e.question_id] });
            qc.invalidateQueries({ queryKey: ["questions"] });
            break;
          case "company.updated":
            qc.invalidateQueries({ queryKey: ["company"] });
            qc.invalidateQueries({ queryKey: ["overview"] });
            break;
          case "queue.updated":
            setState((s) => ({ ...s, queue: { length: e.length, current: e.current } }));
            break;
        }
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [qc]);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
