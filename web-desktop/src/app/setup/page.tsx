"use client";
// First-run setup (desktop only): check the machine, set up the Company, get the local AI ready.
// The backend does the work (api/desktop_setup.py); this page only shows its status and asks.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, cx, inputClass, Label, Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { BUYER_RULE } from "@/lib/labels";
import { type SetupStatus, useSetupStatus } from "@/lib/setup";
import type { BuyerDetailsRule } from "@/lib/types";

const STEPS = ["This computer", "Your Company", "Receipt reader", "Done"] as const;

function Setup() {
  const params = useSearchParams();
  const status = useSetupStatus();
  const [step, setStep] = useState<number | null>(null);
  const s = status.data;

  // Start where it makes sense: a returning user (from the banner) goes straight to the AI step.
  useEffect(() => {
    if (s && step === null) setStep(params.get("step") === "ai" ? 2 : s.company_ok ? 2 : 0);
  }, [s, step, params]);

  if (status.isError) return <Shell><Notice tone="bad">{errorMessage(status.error)}</Notice></Shell>;
  if (!s || step === null) return <Shell><div className="flex justify-center py-16"><Spinner /></div></Shell>;

  return (
    <Shell>
      <ol className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className={cx("flex items-center gap-2", i === step ? "font-medium text-ink" : "text-muted")}>
            <span className={cx("grid size-5 place-items-center rounded-full text-[11px]",
              i < step ? "bg-accent text-accent-ink" : i === step ? "ring-1 ring-accent text-accent" : "ring-1 ring-line-strong")}>
              {i < step ? "✓" : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <Card className="p-8">
        {step === 0 && <MachineStep s={s} next={() => setStep(1)} />}
        {step === 1 && <CompanyStep s={s} back={() => setStep(0)} next={() => setStep(2)} />}
        {step === 2 && <AiStep s={s} back={() => setStep(1)} next={() => setStep(3)} />}
        {step === 3 && <DoneStep s={s} back={() => setStep(2)} />}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src="/logo.png" alt="" className="size-9" />
        Set up Tally
      </div>
      {children}
      <p className="mt-6 text-xs text-faint">
        Tally reads and checks receipts on this computer. After setup it works without the internet.
      </p>
    </main>
  );
}

function Check({ ok, children, hint }: { ok: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <li className="flex gap-3">
      <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px]",
        ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{ok ? "✓" : "!"}</span>
      <span>{children}{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
    </li>
  );
}

function Nav({ back, next, nextLabel = "Continue", busy, disabled, quiet }:
  { back?: () => void; next: () => void; nextLabel?: string; busy?: boolean; disabled?: boolean; quiet?: boolean }) {
  return (
    <div className="mt-8 flex justify-between gap-3">
      {back ? <Button variant="ghost" onClick={back}>Back</Button> : <span />}
      <Button variant={quiet ? "secondary" : "primary"} onClick={next} busy={busy} disabled={disabled}>{nextLabel}</Button>
    </div>
  );
}

function MachineStep({ s, next }: { s: SetupStatus; next: () => void }) {
  const m = s.machine;
  return (
    <>
      <h1 className="text-xl font-semibold">Welcome to Tally</h1>
      <p className="mt-1 text-muted">Tally needs a few things on this computer to read receipts without the cloud.</p>
      <ul className="mt-6 space-y-3">
        <Check ok={m.ram_ok} hint={m.ram_ok ? undefined : "Tally needs 8 GB to read receipts. You can still review and export."}>
          {m.ram_gb} GB of memory
        </Check>
        <Check ok={m.disk_ok} hint={m.disk_ok ? "The receipt reader needs about 3 GB." : "Free up about 4 GB: the receipt reader is a one-time download."}>
          {m.free_gb} GB free on disk
        </Check>
        {m.macos !== null && (
          <Check ok={m.macos_ok} hint={m.macos_ok ? undefined : "The receipt reader needs macOS 14 Sonoma or newer."}>
            macOS {m.macos}
          </Check>
        )}
      </ul>
      <Nav next={next} />
    </>
  );
}

function CompanyStep({ s, back, next }: { s: SetupStatus; back: () => void; next: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(s.company.name);
  const [tin, setTin] = useState(s.company.tin);
  const [rule, setRule] = useState<BuyerDetailsRule>(s.company.buyer_details_rule);
  const save = useMutation({
    mutationFn: () => api.post("/api/setup/company", { name, tin, buyer_details_rule: rule }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setup"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      next();
    },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h1 className="text-xl font-semibold">Your Company</h1>
      <p className="mt-1 text-muted">Receipts must name your Company as the buyer. Tally checks them against these details.</p>
      <div className="mt-6 space-y-4">
        <Label label="Registered name">
          <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); save.reset(); }} placeholder="Bayanihan Trading Corp." required autoFocus />
        </Label>
        <Label label="TIN" hint="9 digits, plus the branch code if you have it, e.g. 123-456-789-00000">
          <input className={inputClass} value={tin} onChange={(e) => { setTin(e.target.value); save.reset(); }} inputMode="numeric" placeholder="123-456-789-00000" required />
        </Label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Receipts that must show your Company as the buyer</legend>
          {(Object.keys(BUYER_RULE) as BuyerDetailsRule[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="rule" checked={rule === r} onChange={() => setRule(r)} />
              {BUYER_RULE[r]}
            </label>
          ))}
          <span className="block text-xs text-muted">You can change this later from the top bar.</span>
        </fieldset>
      </div>
      {save.isError && <Notice tone="bad" className="mt-4">{errorMessage(save.error)}</Notice>}
      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" onClick={back}>Back</Button>
        <Button variant="primary" type="submit" busy={save.isPending} disabled={!name.trim() || !tin.trim()}>Continue</Button>
      </div>
    </form>
  );
}

function Progress({ done, total }: { done?: number; total?: number }) {
  const pct = total ? Math.min(100, ((done ?? 0) / total) * 100) : null;
  const gb = (n: number) => (n / 1e9).toFixed(2);
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={cx("h-full rounded-full bg-accent transition-[width] duration-[1900ms] ease-linear", pct === null && "pulse w-1/3")} style={pct !== null ? { width: `${pct}%` } : undefined} />
      </div>
      {total ? <p className="num mt-1 text-xs text-muted">{gb(done ?? 0)} of {gb(total)} GB · {Math.floor(pct ?? 0)}%</p> : null}
    </div>
  );
}

/** Plain words for whatever went wrong; the technical message stays on hover. */
function Problem({ raw, kind }: { raw?: string | null; kind: "install" | "download" }) {
  const text = kind === "install"
    ? /checksum|match/i.test(raw ?? "") ? "The download didn’t pass its safety check, so nothing was installed. Please try again."
      : /writable|Applications/i.test(raw ?? "") ? "Tally couldn’t install into your Applications folder. Check that you can add apps, then try again."
      : "The setup couldn’t finish. Check the internet connection and try again."
    : "The download stopped. Check the internet connection and try again; it picks up where it left off.";
  return <Notice tone="bad"><span title={raw ?? undefined}>{text}</span></Notice>;
}

function AiStep({ s, back, next }: { s: SetupStatus; back: () => void; next: () => void }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["setup"] });
  const call = (path: string) => api.post(path).finally(refresh);
  const install = useMutation({ mutationFn: () => call("/api/setup/ollama/install") });
  const start = useMutation({ mutationFn: () => call("/api/setup/ollama/start") });
  const pull = useMutation({ mutationFn: () => call("/api/setup/model/pull") });
  const cancel = useMutation({ mutationFn: () => call("/api/setup/model/cancel") });
  const o = s.ollama;
  const ready = o.state === "running" && s.model.present;
  const installing = s.install.state === "running" || install.isPending;
  const downloading = s.pull.state === "running";
  const paused = s.pull.state === "idle" && s.pull.status === "Paused";

  // Keep it moving without asking: start an installed engine, then fetch what it reads with.
  useEffect(() => {
    if (o.state === "stopped" && !start.isPending && !start.isError) start.mutate();
  }, [o.state, start]);
  useEffect(() => {
    if (o.state === "running" && !s.model.present && s.pull.state === "idle" && !paused && !pull.isPending && !pull.isSuccess) pull.mutate();
  }, [o.state, s.model.present, s.pull.state, paused, pull]);

  return (
    <>
      <h1 className="text-xl font-semibold">Set up the receipt reader</h1>
      <p className="mt-1 text-muted">
        Tally reads receipts with an AI that runs on this computer, so your receipts never leave it. It’s a one-time
        download of about 2.7 GB; after that, Tally works without the internet.
      </p>

      <div className="mt-6 space-y-3">
        {ready ? (
          <Notice tone="ok">The receipt reader is ready.</Notice>
        ) : installing ? (
          <div className="text-sm">
            Downloading, part 1 of 2…
            <Progress done={s.install.done} total={s.install.total} />
          </div>
        ) : downloading ? (
          <div className="text-sm">
            Downloading, part 2 of 2…
            <Progress done={s.pull.done} total={s.pull.total} />
            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={() => cancel.mutate()}>Pause</Button>
              <span className="text-xs text-muted">You can continue while it downloads.</span>
            </div>
          </div>
        ) : o.state === "stopped" || start.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Starting the receipt reader…</p>
        ) : o.state === "missing" || o.state === "outdated" ? (
          <>
            {o.state === "outdated" && <Notice tone="warn">An older version is installed. Tally needs to update it.</Notice>}
            <Button variant="primary" onClick={() => install.mutate()}>{o.state === "missing" ? "Set it up" : "Update"}</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => pull.mutate()} busy={pull.isPending}>{paused ? "Resume download" : "Download"}</Button>
        )}
        {s.install.state === "failed" && !installing && <Problem kind="install" raw={s.install.error} />}
        {install.isError && <Problem kind="install" raw={errorMessage(install.error)} />}
        {start.isError && <Notice tone="bad"><span title={errorMessage(start.error)}>The receipt reader didn’t start. Quit Tally and open it again.</span></Notice>}
        {s.pull.state === "failed" && !downloading && <Problem kind="download" raw={s.pull.error} />}
        <p className="text-xs text-muted">Downloaded from the official source and checked before it’s installed.</p>
      </div>

      <Nav back={back} next={next} nextLabel={ready ? "Continue" : "Continue, finish later"} quiet={!ready} />
    </>
  );
}

function DoneStep({ s, back }: { s: SetupStatus; back: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const finish = useMutation({
    mutationFn: () => api.post("/api/setup/complete"),
    onSuccess: () => {
      // Mark it done in the cache first, or the dashboard's gate sees the stale status and sends us back.
      qc.setQueryData<SetupStatus | null>(["setup"], (d) => (d ? { ...d, complete: true } : d));
      qc.invalidateQueries({ queryKey: ["company"] });
      router.replace("/");
    },
  });
  return (
    <>
      <h1 className="text-xl font-semibold">You’re set</h1>
      <ul className="mt-4 space-y-2 text-sm">
        <li>Create a Cash Advance for an Employee, then open its Liquidation.</li>
        <li>Scan receipts with your phone: it must be on the same Wi-Fi as this computer. Open the Liquidation and scan its QR code.</li>
        <li>Or drop receipt photos onto the Liquidation from this computer.</li>
        {!s.model.present && <li className="text-warn">The AI model is still getting ready. Receipts wait until it is.</li>}
      </ul>
      {finish.isError && <Notice tone="bad" className="mt-4">{errorMessage(finish.error)}</Notice>}
      <Nav back={back} next={() => finish.mutate()} nextLabel="Open Tally" busy={finish.isPending} />
    </>
  );
}

export default function SetupPage() {
  return <Suspense><Setup /></Suspense>;
}
