import {
  CaretDownIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  LaptopIcon,
} from "@phosphor-icons/react/dist/ssr";
import { KeepTogether, SectionHeader, SectionShell } from "@/components/marketing";
import { PRIVACY_PROMISE } from "./Privacy";

const NEEDS = [
  { Icon: LaptopIcon, title: "A Mac with Apple Silicon", body: "M1 or newer, with 8 GB of memory. Windows is coming." },
  { Icon: DeviceMobileIcon, title: "Any phone with a camera", body: "On the same Wi-Fi as your computer." },
  { Icon: DownloadSimpleIcon, title: "Internet once", body: "Only to set up. After that, it works offline." },
];

export function Requirements() {
  return (
    <SectionShell tone="panel" labelledBy="requirements-title">
      <SectionHeader id="requirements-title" label="Requirements" title="What you need" />
      {/* Same card rhythm as the Privacy and checks grids. */}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {NEEDS.map(({ Icon, title, body }) => (
          <li key={title} className="rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
            <span className="grid size-12 place-items-center rounded-full bg-lime text-lime-ink">
              <Icon aria-hidden className="size-6" />
            </span>
            <h3 className="mt-7 text-lg font-semibold">{title}</h3>
            <p className="mt-3 leading-relaxed text-muted">
              <KeepTogether text={body} />
            </p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

const FAQ = [
  { q: "Does any data leave my laptop?", a: PRIVACY_PROMISE },
  { q: "Who can see my data?", a: "Only you. Your receipts and reports stay on your laptop, and Tally's makers have no copy and no way to look at them." },
  { q: "Does it work without internet?", a: "Yes, once set up. The internet is needed only once, for the download." },
  {
    q: "What if Tally misreads a receipt?",
    a: "Just correct it and Tally checks the receipt again. If a VAT amount doesn't add up, the receipt is always flagged, so a misread never slips through quietly.",
  },
  { q: "Does the AI decide whether a receipt is valid?", a: "No. The AI only reads the receipt. Fixed BIR rules do the checking, and you make the final call." },
  { q: "Can I overrule a flag?", a: "Yes. Dismiss it and write a short reason. It stays on record as dismissed." },
  { q: "What computer do I need?", a: "A Mac with Apple Silicon (M1 or newer), macOS 14 Sonoma or newer and 8 GB of memory. A Windows version is coming." },
  { q: "What does it cost?", a: "Tally is free while it's in its pilot." },
];

function Question({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-3xl bg-surface px-6 shadow-card ring-1 ring-line">
      <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-lg font-medium">
        {q}
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken transition-colors group-open:bg-lime group-open:text-lime-ink">
          <CaretDownIcon aria-hidden className="faq-chevron size-4 transition-transform duration-200 ease-out" />
        </span>
      </summary>
      <p className="faq-answer max-w-prose pb-6 leading-relaxed text-muted">
        <KeepTogether text={a} />
      </p>
    </details>
  );
}

export function Faq() {
  // Two independent columns on desktop, so opening a question only pushes down its own column.
  const half = Math.ceil(FAQ.length / 2);
  const columns = [FAQ.slice(0, half), FAQ.slice(half)];
  return (
    <SectionShell tone="plain" id="faq" labelledBy="faq-title">
      <SectionHeader id="faq-title" label="FAQ" title="Questions accountants ask" />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-5">
        {columns.map((col, i) => (
          <div key={i} className="space-y-3">
            {col.map((item) => (
              <Question key={item.q} {...item} />
            ))}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
