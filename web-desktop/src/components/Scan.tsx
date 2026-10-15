"use client";
// Scanning from the home page: a "Scan receipts" button and photos dropped anywhere on the page.
// A receipt always belongs to a Liquidation (GLOSSARY), so scanning starts by choosing the open Cash
// Advance: skipped when only one is open; "New Cash Advance" first when none is.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { photoFiles } from "@/lib/photos";
import { useCashAdvances } from "@/lib/queries";
import { liquidationHref } from "@/lib/routes";
import type { CashAdvance } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Notice } from "./ui";
import { toast } from "@/lib/toast";

const photos = photoFiles;

export function useScan(onNewCashAdvance: () => void) {
  const router = useRouter();
  const qc = useQueryClient();
  const open = useCashAdvances("OPEN");
  const openOnes = open.data ?? [];
  const [choosing, setChoosing] = useState<null | { files: File[] }>(null);
  const upload = useMutation({
    mutationFn: ({ ca, files }: { ca: CashAdvance; files: File[] }) =>
      api.upload(`/api/liquidations/${ca.liquidation.id}/receipts`, files).then(() => ca),
    onSuccess: (ca, { files }) => {
      toast(`${files.length} photo${files.length === 1 ? "" : "s"} added`, { body: `To ${ca.employee.name}: ${ca.purpose}. Tally is reading them now.` });
      qc.invalidateQueries({ queryKey: ["liquidation", ca.liquidation.id] });
      router.push(liquidationHref(ca.liquidation.id));
    },
  });
  const go = (ca: CashAdvance, files: File[]) => {
    setChoosing(null);
    if (files.length) upload.mutate({ ca, files });
    else router.push(liquidationHref(ca.liquidation.id));
  };
  const start = (files: File[]) => {
    if (open.isSuccess && openOnes.length === 0) return onNewCashAdvance();
    if (openOnes.length === 1) return go(openOnes[0], files);
    setChoosing({ files });
  };

  const dialog = (
    <Dialog open={!!choosing} onClose={() => setChoosing(null)} wide title="For which Cash Advance?"
      description={choosing?.files.length
        ? `${choosing.files.length} photo${choosing.files.length === 1 ? "" : "s"} will be read and checked against its Spending Period.`
        : "Receipts are checked against its Spending Period and Employee."}
      footer={<Button variant="ghost" onClick={() => setChoosing(null)}>Cancel</Button>}>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {openOnes.map((ca) => (
          <li key={ca.id}>
            <button type="button" onClick={() => choosing && go(ca, choosing.files)}
              className="flex w-full items-center gap-4 rounded-2xl border border-line px-4 py-3 text-left transition-colors duration-150 hover:bg-sunken">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{ca.employee.name}</span>
                <span className="block truncate text-sm text-muted">{ca.purpose} · {formatDate(ca.released_on)} – {formatDate(ca.spending_end_on)}</span>
              </span>
              <span aria-hidden className="text-muted">→</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
  return { start, busy: upload.isPending, error: upload.error, dialog };
}

/** The page's main action. */
export function ScanButton({ scan }: { scan: ReturnType<typeof useScan> }) {
  return (
    <Button variant="primary" busy={scan.busy} onClick={() => scan.start([])}>
      {!scan.busy && (
        <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 1.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" /><path d="M6 5h4M6 8h4" />
        </svg>
      )}
      Scan receipts
    </Button>
  );
}

/** Photos dropped anywhere inside go through the same choice. */
export function ScanDropArea({ scan, children }: { scan: ReturnType<typeof useScan>; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  return (
    <div
      className="relative"
      onDragEnter={(e) => { if (e.dataTransfer.types.includes("Files")) { depth.current++; setOver(true); } }}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); const f = photos(e.dataTransfer.files); if (f.length) scan.start(f); }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute -inset-3 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-line-strong bg-surface/80 text-sm text-muted">
          Drop receipt photos to scan them
        </div>
      )}
      {scan.error && <Notice tone="bad" className="mt-4">{errorMessage(scan.error)}</Notice>}
      {scan.dialog}
    </div>
  );
}
