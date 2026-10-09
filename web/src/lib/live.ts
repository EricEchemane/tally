"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LiveEvent } from "./types";

/** One socket for the whole app. Events are hints: invalidate, then react-query refetches via REST. */
export function useLiveEvents(onEvent?: (e: LiveEvent) => void) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => {
        setConnected(true);
        qc.invalidateQueries(); // no replay: refetch everything on (re)connect
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(open, 1000);
      };
      socket.onmessage = (msg) => {
        const e = JSON.parse(msg.data) as LiveEvent;
        switch (e.event) {
          case "receipt.stage":
          case "receipt.updated":
            qc.invalidateQueries({ queryKey: ["receipt", e.receipt_id] });
            qc.invalidateQueries({ queryKey: ["liquidation", e.liquidation_id] });
            break;
          case "receipt.failed":
            qc.invalidateQueries({ queryKey: ["receipt", e.receipt_id] });
            break;
          case "liquidation.updated":
            qc.invalidateQueries({ queryKey: ["liquidation", e.liquidation_id] });
            qc.invalidateQueries({ queryKey: ["cash-advances"] });
            break;
          case "question.answered":
            qc.invalidateQueries({ queryKey: ["question", e.question_id] });
            qc.invalidateQueries({ queryKey: ["questions"] });
            break;
          case "company.updated":
            qc.invalidateQueries({ queryKey: ["company"] });
            break;
        }
        onEvent?.(e);
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [qc, onEvent]);

  return connected;
}
