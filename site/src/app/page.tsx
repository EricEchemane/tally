import { Assistant } from "@/components/sections/Assistant";
import { Checks, ChecksBand } from "@/components/sections/Checks";
import { Faq, Requirements } from "@/components/sections/Closing";
import { Exports } from "@/components/sections/Exports";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Privacy } from "@/components/sections/Privacy";
import { Problem } from "@/components/sections/Problem";
import { Review } from "@/components/sections/Review";

// Section order and copy follow LANDING.md. Privacy comes before the features on purpose.
// Everything below the hero renders lazily (see .lazy-section in globals.css), so the first screen paints sooner.
export default function Home() {
  return (
    <>
      <Hero />
      {/* Below the hero the page is always dark: near-black base with deep-green panels (see .section-dark). */}
      <div className="section-dark pb-3">
        <div className="lazy-section"><Problem /></div>
        <div className="lazy-section"><Privacy /></div>
        <div className="lazy-section"><HowItWorks /></div>
        <ChecksBand />
        <div className="lazy-section"><Checks /></div>
        <div className="lazy-section"><Review /></div>
        <div className="lazy-section"><Assistant /></div>
        <div className="lazy-section"><Exports /></div>
        <div className="lazy-section"><Requirements /></div>
        <div className="lazy-section"><Faq /></div>
      </div>
    </>
  );
}
