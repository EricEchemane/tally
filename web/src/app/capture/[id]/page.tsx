"use client";
// Hour-0 phone capture page (SPEC §7). Simon owns the design.
import { useMutation } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";

function Capture() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("t") ?? "";
  const [sent, setSent] = useState(0);
  const upload = useMutation({
    mutationFn: (files: FileList) =>
      api.upload<{ id: number }[]>(`/api/liquidations/${id}/receipts?t=${encodeURIComponent(token)}`, files),
    onSuccess: (r) => setSent((n) => n + r.length),
  });
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) upload.mutate(e.target.files);
    e.target.value = "";
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Tally capture</h1>
      <label className="rounded border p-4 text-center text-lg">
        Take photo
        <input type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      </label>
      <label className="rounded border p-4 text-center text-lg">
        Choose from gallery
        <input type="file" accept="image/*" multiple hidden onChange={pick} />
      </label>
      <p className="text-center text-sm opacity-70">
        {upload.isPending ? "Uploading…" : upload.isError ? "Upload failed — try again" : `${sent} sent`}
      </p>
    </main>
  );
}

export default function CapturePage() {
  return <Suspense><Capture /></Suspense>;
}
