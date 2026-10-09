"use client";
// Settings: the Company's details, the local AI, back up and restore, and the app version.
// Back up / Restore and the AI status are desktop-only (api/desktop_setup.py).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DownloadButton } from "@/components/Downloads";
import { Button, Card, CardHeader, cx, inputClass, Label, Notice, PageHeader } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { BUYER_RULE, formatTinFull } from "@/lib/labels";
import { useCompany } from "@/lib/queries";
import { useSetupStatus } from "@/lib/setup";
import type { BuyerDetailsRule, Company } from "@/lib/types";

export default function SettingsPage() {
  const setup = useSetupStatus();
  const desktop = !!setup.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" sub={setup.data ? `Tally ${setup.data.version}` : undefined} />
      <CompanyCard />
      {desktop && <AiCard />}
      {desktop && <DataCard />}
    </div>
  );
}

function CompanyCard() {
  const qc = useQueryClient();
  const company = useCompany();
  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [rule, setRule] = useState<BuyerDetailsRule>("ALL_RECEIPTS");
  useEffect(() => {
    if (company.data) {
      setName(company.data.name);
      setTin(formatTinFull(company.data.tin));
      setRule(company.data.buyer_details_rule);
    }
  }, [company.data]);
  const save = useMutation({
    mutationFn: () => api.patch<Company>("/api/company", { name, tin, buyer_details_rule: rule }),
    onSuccess: (c) => {
      qc.setQueryData(["company"], c);
      qc.invalidateQueries({ queryKey: ["setup"] });
    },
  });
  const changed = company.data && (name !== company.data.name || tin.replace(/\D/g, "") !== company.data.tin || rule !== company.data.buyer_details_rule);

  return (
    <Card>
      <CardHeader title="Your Company" sub="Receipts must name your Company as the buyer. Saving re-checks every open Liquidation." />
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Label label="Registered name">
          <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); save.reset(); }} required />
        </Label>
        <Label label="TIN" hint="9 digits, plus the branch code if you have it">
          <input className={inputClass} value={tin} onChange={(e) => { setTin(e.target.value); save.reset(); }} inputMode="numeric" required />
        </Label>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Receipts that must show your Company as the buyer</legend>
          {(Object.keys(BUYER_RULE) as BuyerDetailsRule[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="rule" checked={rule === r} onChange={() => { setRule(r); save.reset(); }} />
              {BUYER_RULE[r]}
            </label>
          ))}
        </fieldset>
        {save.isError && <Notice tone="bad" className="sm:col-span-2">{errorMessage(save.error)}</Notice>}
        {save.isSuccess && !changed && <Notice tone="ok" className="sm:col-span-2">Saved. Open Liquidations were re-checked.</Notice>}
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" busy={save.isPending} disabled={!changed}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}

function AiCard() {
  const s = useSetupStatus().data;
  if (!s) return null;
  const ready = s.ollama.state === "running" && s.model.present;
  return (
    <Card>
      <CardHeader title="Local AI" sub="Reads receipts and answers questions on this computer." />
      <div className="space-y-4 p-6">
        <Notice tone={ready ? "ok" : "warn"}>
          {ready
            ? "Ready. Receipts are read on this computer."
            : s.ollama.state !== "running"
              ? "The AI isn’t running, so new receipts wait until it is."
              : "The AI isn’t downloaded yet, so new receipts wait until it is."}
        </Notice>
        <p className="text-xs text-muted">Ollama {s.ollama.version ?? "not running"} · model {s.model.name}</p>
        <Link href="/setup/?step=ai" className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-medium hover:bg-sunken">
          {ready ? "Open AI setup" : "Fix in setup"}
        </Link>
      </div>
    </Card>
  );
}

function DataCard() {
  const qc = useQueryClient();
  const s = useSetupStatus().data;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const restore = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/setup/restore", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as { from_version: string; created_at: string };
    },
    onSuccess: () => {
      setFile(null);
      qc.invalidateQueries();
    },
  });

  return (
    <Card>
      <CardHeader title="Back up and restore" sub="One file holds every Cash Advance, receipt photo and correction." />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <DownloadButton href="/api/setup/backup" variant="primary">Back up now</DownloadButton>
          <span className="text-sm text-muted">Save the file somewhere safe, such as a USB drive.</span>
        </div>

        <div className="space-y-3 border-t border-line pt-6">
          <p className="text-sm font-medium">Restore from a backup</p>
          <p className="text-sm text-muted">This replaces everything in Tally with the backup. Your current data is backed up automatically first.</p>
          <input ref={input} type="file" accept=".zip,application/zip" hidden
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); restore.reset(); e.target.value = ""; }} />
          {!file ? (
            <Button onClick={() => input.current?.click()}>Choose a backup file…</Button>
          ) : (
            <Notice tone="warn" className="enter">
              <p>Replace everything in Tally with <span className="font-medium">{file.name}</span>?</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="danger" busy={restore.isPending} onClick={() => restore.mutate(file)}>Replace and restore</Button>
                <Button size="sm" variant="ghost" onClick={() => setFile(null)}>Cancel</Button>
              </div>
            </Notice>
          )}
          {restore.isError && <Notice tone="bad">{errorMessage(restore.error)}</Notice>}
          {restore.isSuccess && (
            <Notice tone="ok">Restored the backup from {restore.data.created_at.replace("T", " ")}.</Notice>
          )}
        </div>

        {s && (
          <p className={cx("border-t border-line pt-6 text-xs text-muted")}>
            Data folder: <span className="font-mono">{s.data_dir}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
