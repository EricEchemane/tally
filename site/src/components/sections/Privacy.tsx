import { CloudSlashIcon, CoinsIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { Label } from "@/components/marketing";
import { DataPath } from "./PrivacyDiagram";

/** Use as written in LANDING.md: the privacy promise is word for word on the page and in the FAQ. */
export const PRIVACY_PROMISE =
  "Your receipts and tax data never leave your laptop. The internet is needed once, to set up; after that, Tally works offline. Your phone sends photos straight to your laptop over your office Wi-Fi.";

const POINTS = [
  { Icon: CloudSlashIcon, title: "No cloud", body: "The AI runs on your laptop." },
  { Icon: WifiSlashIcon, title: "Works offline", body: "Once set up, no internet is needed." },
  { Icon: CoinsIcon, title: "No cost per receipt", body: "Checking a whole pile costs nothing extra." },
];

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="px-3">
      <div className="rounded-[2rem] bg-mint">
        <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16">
            <div>
              <Label>Private by design</Label>
              <h2 id="privacy-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl sm:leading-[1.05]">
                Your tax data stays in the office.
              </h2>
              <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-muted">{PRIVACY_PROMISE}</p>
            </div>
            <DataPath />
          </div>

          <dl className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {POINTS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
                <dt className="font-semibold">
                  <span className="mb-4 grid size-11 place-items-center rounded-full bg-lime text-lime-ink">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  {title}
                </dt>
                <dd className="mt-1.5 text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
