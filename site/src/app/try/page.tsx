import type { Metadata } from "next";
import { MAC_DOWNLOAD_URL, RELEASES_URL } from "@/lib/links";

export const metadata: Metadata = { title: "Try Tally" };

const REQUIREMENTS = [
  "A Mac with Apple Silicon (M1 or newer) on macOS 14 Sonoma or newer",
  "8 GB of memory",
  "About 4 GB of free disk space",
  "An internet connection once, to download the local AI during setup",
];

const STEPS = [
  { title: "Install", body: "Open the downloaded file and drag Tally into Applications." },
  {
    title: "Open it the first time",
    body: "This pilot build isn’t notarized by Apple yet. macOS says it can’t check it: click Done, then go to System Settings → Privacy & Security and click Open Anyway.",
  },
  { title: "Set up", body: "Enter your company’s name and TIN. Tally then downloads its local AI, about 2.5 GB." },
  { title: "Check receipts", body: "Create a cash advance and scan receipts with your phone. From here on, nothing leaves your Mac." },
];

export default function TryTally() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:pt-24">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Try Tally on your Mac</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Check your own receipts against BIR rules, on your own computer. After the first setup it works without the internet.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a href={MAC_DOWNLOAD_URL}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover">
          <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
          </svg>
          Download for Mac
        </a>
        <p className="text-sm text-muted">
          Version 0.1.0 · Apple Silicon · 44 MB ·{" "}
          <a href={RELEASES_URL} className="underline hover:text-ink">Release notes and checksum</a>
        </p>
      </div>
      <p className="mt-3 text-sm text-muted">Windows: not yet available.</p>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">What you need</h2>
          <ul className="mt-4 space-y-2 text-muted">
            {REQUIREMENTS.map((r) => <li key={r} className="flex gap-2"><span aria-hidden className="text-accent">•</span>{r}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Getting started</h2>
          <ol className="mt-4 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-medium">{i + 1}</span>
                <span>
                  <span className="block font-medium">{s.title}</span>
                  <span className="text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
