import { CoinsIcon, EyeIcon, IdentificationCardIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { ImageSlot, Label } from "@/components/marketing";

const POINTS = [
  { Icon: EyeIcon, text: "Every receipt is checked by hand, one by one." },
  { Icon: IdentificationCardIcon, text: "Each one must follow BIR rules and show your company's name and TIN." },
  { Icon: CoinsIcon, text: "A rejected receipt means the employee pays it back. Mistakes cost real money." },
  {
    Icon: LockSimpleIcon,
    text: (
      <>
        <strong className="font-semibold">&ldquo;Privacy is the priority.&rdquo;</strong>{" "}
        <span className="text-muted">Consolidated reports and the SLSP are always confidential.</span>
      </>
    ),
  },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-title">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 py-24 lg:grid-cols-2 lg:gap-16 lg:py-32">
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
          <p className="mt-5 text-muted">From an accountant who handles liquidations for Philippine companies.</p>

          {/* Equal rows: every point gets the tallest point's height, icon and text centred in it, so the spacing between
              points is the same whatever their length. The privacy line is the fourth point, so all four share one icon column. */}
          <ul className="mt-8 grid auto-rows-fr gap-4">
            {POINTS.map(({ Icon, text }, i) => (
              <li key={i} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
