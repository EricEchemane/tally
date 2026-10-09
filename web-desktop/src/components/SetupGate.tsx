"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSetupStatus } from "@/lib/setup";

/** A new install goes to the setup wizard first. Afterwards, a banner stays up until the model is ready. */
export function SetupGate() {
  const router = useRouter();
  const status = useSetupStatus();
  const s = status.data;
  useEffect(() => {
    if (s && !s.complete) router.replace("/setup/");
  }, [s, router]);
  if (!s || !s.complete || s.model.present) return null;
  const pulling = s.pull.state === "running";
  const pct = pulling && s.pull.total ? Math.floor(((s.pull.done ?? 0) / s.pull.total) * 100) : null;
  return (
    <div className="mx-auto mt-1 max-w-6xl px-6"><div className="rounded-full border border-warn/30 bg-warn-soft px-5 py-2 text-center text-sm">
      {pulling
        ? `Downloading the AI model${pct !== null ? ` (${pct}%)` : ""}. Receipts you scan now wait until it finishes.`
        : s.ollama.state !== "running"
          ? "The AI isn’t running, so new receipts wait until it is."
          : "The AI isn’t downloaded yet, so new receipts wait until it is."}{" "}
      <Link href="/setup/?step=ai" className="font-medium underline">Open setup</Link>
    </div></div>
  );
}
