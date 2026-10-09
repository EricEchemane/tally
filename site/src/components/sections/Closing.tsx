import {
  CaretDownIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  LaptopIcon,
  WindowsLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Label } from "@/components/marketing";
import { PRIVACY_PROMISE } from "./Privacy";

const NEEDS = [
  { Icon: LaptopIcon, text: "A Mac with Apple Silicon (M1 or later) and 8 GB RAM or more" },
  { Icon: DeviceMobileIcon, text: "Any phone with a camera, on the same Wi-Fi as the Mac" },
  { Icon: DownloadSimpleIcon, text: "Internet once, for setup (an AI model download of about 2.5 GB)" },
];

export function Requirements() {
  return (
    <section aria-labelledby="requirements-title">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:py-32">
        <div>
          <Label>Requirements</Label>
          <h2 id="requirements-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
            What you need
          </h2>
        </div>
        <div className="rounded-3xl bg-surface shadow-card ring-1 ring-line">
          <ul className="divide-y divide-line">
            {NEEDS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-4 px-6 py-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-4 rounded-b-3xl border-t border-line bg-sunken px-6 py-4 text-muted">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
              <WindowsLogoIcon aria-hidden className="size-5" />
            </span>
            Windows: planned. Tell us on GitHub if you need it.
          </p>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Does any data leave my laptop?", a: PRIVACY_PROMISE },
  { q: "Does it work without internet?", a: "Yes, once set up. The internet is needed only once, for the download." },
  {
    q: "What if Tally misreads a receipt?",
    a: "You correct the value and the checks re-run. If a VAT amount doesn't add up, the receipt is always flagged, so a misread amount never passes silently.",
  },
  { q: "Does the AI decide whether a receipt is valid?", a: "No. The AI only reads the receipt. Code applies the BIR rules, and you approve." },
  { q: "Can I overrule a Finding?", a: "Yes: dismiss it with a reason. It stays on record as dismissed." },
  { q: "What computer do I need?", a: "A Mac with Apple Silicon and 8 GB RAM. Windows is planned." },
  { q: "What does it cost?", a: "Tally is free while it's in its pilot." },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-sunken">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:py-32">
        <div>
          <Label>FAQ</Label>
          <h2 id="faq-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
            Questions accountants ask
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-3xl bg-surface px-6 ring-1 ring-line open:shadow-card">
              <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-lg font-medium">
                {q}
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken transition-colors group-open:bg-lime group-open:text-lime-ink">
                  <CaretDownIcon aria-hidden className="faq-chevron size-4 transition-transform duration-200 ease-out" />
                </span>
              </summary>
              <p className="faq-answer max-w-prose pb-6 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
