import { CoinsIcon, EyeIcon, IdentificationCardIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { ImageSlot, Label } from "@/components/marketing";

const POINTS = [
  { Icon: EyeIcon, text: "Every receipt is eyeballed." },
  { Icon: IdentificationCardIcon, text: "It must be BIR-compliant and show the Company's name and TIN." },
  { Icon: CoinsIcon, text: "A rejected receipt means the Employee pays that amount back, so a mistake costs someone real money." },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-title">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <ImageSlot
          file="accountant-receipts.jpg"
          what="A happy Filipino accountant snapping a receipt with her phone, laptop open, work done early"
          className="aspect-[4/3] w-full"
        />

        <div>
          <Label>What accountants told us</Label>
          <h2 id="problem-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
            Receipts are still checked by eye.
          </h2>
          <p className="mt-3 text-muted">From an accountant who handles liquidations for Philippine companies.</p>

          <ul className="mt-8 space-y-5">
            {POINTS.map(({ Icon, text }) => (
              <li key={text} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="pt-2 leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>

          <figure className="mt-10 flex items-center gap-4 rounded-[1.75rem] bg-mint py-2 pr-6 pl-2 sm:rounded-full">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
              <LockSimpleIcon aria-hidden weight="bold" className="size-5" />
            </span>
            <blockquote className="text-sm leading-snug">
              <span className="font-semibold">&ldquo;Privacy is the priority.&rdquo;</span>{" "}
              <span className="text-muted">Consolidated reports and the SLSP are always confidential.</span>
            </blockquote>
          </figure>
        </div>
      </div>
    </section>
  );
}
