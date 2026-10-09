"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useCaptureLink } from "@/lib/queries";
import { Dialog } from "./Dialog";
import { Button, Card, CardHeader, cx, Notice, Spinner } from "./ui";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif";

/** Drag-and-drop or multi-file picker on the Liquidation screen (SPEC §7). */
export function UploadDropzone({ liquidationId }: { liquidationId: number }) {
  const qc = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const upload = useMutation({
    mutationFn: (files: File[]) => api.upload<{ id: number }[]>(`/api/liquidations/${liquidationId}/receipts`, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["liquidation", liquidationId] }),
  });

  const send = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
    if (files.length) upload.mutate(files);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => picker.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }}
        className={cx(
          "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          over ? "border-accent bg-accent-soft" : "border-line-strong bg-sunken/50 hover:border-accent",
        )}
      >
        {upload.isPending ? (
          <span className="flex items-center gap-2 text-sm"><Spinner /> Uploading…</span>
        ) : (
          <>
            <span className="text-sm font-medium">Drop receipt photos here, or click to choose</span>
            <span className="text-xs text-muted">JPEG, PNG or HEIC. Several at once is fine: each photo is one receipt.</span>
          </>
        )}
      </button>
      <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={(e) => {
        send(e.target.files);
        e.target.value = "";
      }} />
      {upload.isError && <Notice tone="bad">Upload failed: {errorMessage(upload.error)}</Notice>}
    </div>
  );
}

/** QR code the Reviewer scans with a phone to open the capture page. */
export function CapturePanel({ liquidationId }: { liquidationId: number }) {
  const link = useCaptureLink(liquidationId);
  const [big, setBig] = useState(false);
  return (
    <Card>
      <CardHeader title="Scan with your phone" sub="Same Wi-Fi as this computer." />
      <div className="flex flex-col items-center gap-3 p-6">
        {link.data ? (
          <>
            <button type="button" onClick={() => setBig(true)} title="Enlarge"
              className="group relative w-60 rounded-2xl border border-line bg-white p-3 transition-transform duration-150 hover:scale-[1.02]">
              <span className="block [&_svg]:h-auto [&_svg]:w-full" aria-label="QR code for the phone capture page" role="img"
                dangerouslySetInnerHTML={{ __html: link.data.qr_svg }} />
            </button>
            <Button size="sm" variant="ghost" onClick={() => setBig(true)}>
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" /></svg>
              Enlarge
            </Button>
            <Dialog open={big} onClose={() => setBig(false)} wide title="Scan with your phone"
              description="Open the camera on a phone on the same Wi-Fi and point it at the code."
              footer={<Button variant="primary" onClick={() => setBig(false)} data-autofocus>Done</Button>}>
              <div className="mx-auto w-[26rem] max-w-full rounded-2xl border border-line bg-white p-4 [&_svg]:h-auto [&_svg]:w-full"
                role="img" aria-label="QR code, large" dangerouslySetInnerHTML={{ __html: link.data.qr_svg }} />
            </Dialog>
            <a href={link.data.url} target="_blank" rel="noreferrer" className="break-all text-center text-xs text-muted hover:text-accent">
              {link.data.url}
            </a>
          </>
        ) : link.isError ? (
          <Notice tone="bad">{errorMessage(link.error)}</Notice>
        ) : (
          <div className="shimmer size-60 rounded-2xl" />
        )}
      </div>
    </Card>
  );
}
