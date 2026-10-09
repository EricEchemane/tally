import { PrimaryCta, SecondaryCta } from "@/components/Cta";
import { Placeholder } from "@/components/Placeholder";

export default function Home() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Spot the slip before the audit trip.
        </h1>
        <p className="mt-4 text-lg text-muted sm:text-xl">BIR-checked liquidations, offline.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <PrimaryCta />
          <SecondaryCta />
        </div>
      </section>

      <Placeholder id="sample-review" title="See it check a receipt">
        Pick a real receipt and watch Tally find its Findings and work out the Amount to Return.
      </Placeholder>

      <Placeholder id="early-access" title="Request early access">
        Tell us about your company and how many cash advances you liquidate a month.
      </Placeholder>
    </>
  );
}
