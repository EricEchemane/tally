"use client";
// Move receipts scanned into the wrong Liquidation to another OPEN one of the same Employee.
// The server re-checks them against the new Spending Period.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { useCashAdvances } from "@/lib/queries";
import { Button, cx, selectClass } from "./ui";

export function MoveReceipts({ receiptIds, employeeId, fromLiquidationId, onDone, onCancel }: {
  receiptIds: number[]; employeeId: number; fromLiquidationId: number; onDone: (to: number) => void; onCancel: () => void;
}) {
  const qc = useQueryClient();
  const open = useCashAdvances("OPEN");
  const targets = (open.data ?? []).filter((c) => c.employee.id === employeeId && c.liquidation.id !== fromLiquidationId);
  const [to, setTo] = useState("");
  const move = useMutation({
    mutationFn: async () => {
      for (const id of receiptIds) await api.post(`/api/receipts/${id}/move`, { liquidation_id: Number(to) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liquidation"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
      qc.invalidateQueries({ queryKey: ["cash-advances"] });
      onDone(Number(to));
    },
  });

  if (open.isSuccess && targets.length === 0) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
        This Employee has no other open Liquidation to move to.
        <Button size="sm" variant="ghost" onClick={onCancel}>OK</Button>
      </span>
    );
  }
  return (
    <span className="enter flex flex-wrap items-center gap-2">
      <select className={cx(selectClass, "h-8 w-auto min-w-56")} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Move to">
        <option value="" disabled>Move to…</option>
        {targets.map((c) => (
          <option key={c.id} value={c.liquidation.id}>{c.purpose} ({formatDate(c.released_on)})</option>
        ))}
      </select>
      <Button size="sm" variant="primary" disabled={!to} busy={move.isPending} onClick={() => move.mutate()}>
        Move{receiptIds.length > 1 ? ` ${receiptIds.length}` : ""}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      {move.isError && <span className="w-full text-xs text-bad">{errorMessage(move.error)}</span>}
    </span>
  );
}
