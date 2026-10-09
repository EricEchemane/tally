import { CloudSlashIcon, CoinsIcon, EyeSlashIcon, ExportIcon, LaptopIcon, LockKeyIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { KeepTogether, Label, SectionShell } from "@/components/marketing";
import { DataPath } from "./PrivacyDiagramLazy";

/** Use as written in LANDING.md: the privacy promise is word for word on the page and in the FAQ. */
export const PRIVACY_PROMISE =
  "Your receipts and tax data never leave your laptop. The internet is needed once, to set up; after that, Tally works offline. Your phone sends photos straight to your laptop over your office Wi-Fi.";

const POINTS = [
  { Icon: CloudSlashIcon, title: "No cloud", body: "The AI runs on your laptop." },
  { Icon: WifiSlashIcon, title: "Works offline", body: "Once set up, no internet is needed." },
  { Icon: CoinsIcon, title: "No cost per receipt", body: "Checking a whole pile costs nothing extra." },
];

const OWNERSHIP = [
  { Icon: LaptopIcon, title: "Kept on your laptop", body: "Receipts, reports and answers are saved on your computer, and nowhere else." },
  { Icon: EyeSlashIcon, title: "Nobody else can see it", body: "Tally's makers have no copy and no way to look at your files." },
  { Icon: ExportIcon, title: "Take it anytime", body: "Export to Excel or CSV whenever you like. The files are yours." },
];

export function Privacy() {
  return (
    <SectionShell tone="panel" id="privacy" labelledBy="privacy-title">
        <div>
          {/* The header shares its row with the route diagram; size and spacing match every other section header. */}
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16">
            <div>
              <Label>Private by design</Label>
              <h2 id="privacy-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
                Your tax data stays in the office.
              </h2>
              <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-muted">
                <KeepTogether text={PRIVACY_PROMISE} />
              </p>
            </div>
            <DataPath />
          </div>

          {/* Same card rhythm as the checks grid: padding, icon to title, title to text. */}
          <dl className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3 lg:mt-16">
            {POINTS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
                <dt className="text-lg font-semibold">
                  <span className="mb-7 grid size-12 place-items-center rounded-full bg-lime text-lime-ink">
                    <Icon aria-hidden className="size-6" />
                  </span>
                  {title}
                </dt>
                <dd className="mt-3 leading-relaxed text-muted">{body}</dd>
              </div>
            ))}
          </dl>

          {/* Ownership band: the trust line in one glance. Claims stay within the promise above (nothing uploaded, no
              cloud, exports are yours); nothing here says "encrypted" or "secure" because the page can't prove it. */}
          <div className="mt-5 grid grid-cols-1 gap-8 rounded-3xl bg-mint-strong p-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center lg:gap-12 lg:p-10">
            <div>
              <span className="grid size-12 place-items-center rounded-full bg-lime text-lime-ink">
                <LockKeyIcon aria-hidden weight="bold" className="size-6" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Your data stays yours.</h3>
              <p className="mt-3 leading-relaxed text-muted">Only you can see it. Nobody else owns or holds a copy.</p>
            </div>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {OWNERSHIP.map(({ Icon, title, body }) => (
                <li key={title} className="border-t border-line-strong pt-5">
                  <Icon aria-hidden className="size-6 text-accent" />
                  <p className="mt-4 font-semibold">{title}</p>
                  <p className="mt-2 leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
    </SectionShell>
  );
}
