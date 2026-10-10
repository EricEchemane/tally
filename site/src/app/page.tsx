import { Assistant } from "@/components/sections/Assistant";
import { Checks, ChecksBand } from "@/components/sections/Checks";
import { Faq, Requirements } from "@/components/sections/Closing";
import { Exports } from "@/components/sections/Exports";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Privacy } from "@/components/sections/Privacy";
import { Problem } from "@/components/sections/Problem";
import { Review } from "@/components/sections/Review";
import { DEMO_DURATION, DEMO_POSTER, DEMO_VIDEO_URL, MAC_DOWNLOAD_URL, SITE_URL } from "@/lib/links";

// Structured data for search engines: the app itself, and the demo video so it can show in video results.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tally",
    url: SITE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "macOS 14 or newer (Apple Silicon)",
    downloadUrl: MAC_DOWNLOAD_URL,
    description:
      "Checks every receipt in a cash advance liquidation against BIR rules, offline on your Mac. The AI only reads receipts; fixed rules do the checking.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "PHP" },
    screenshot: `${SITE_URL}${DEMO_POSTER}`,
  },
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Tally demo: checking a liquidation's receipts offline",
    description:
      "Scan receipts with your phone, see which ones need a second look, and ask Tally about your liquidations, all on your Mac.",
    thumbnailUrl: `${SITE_URL}${DEMO_POSTER}`,
    contentUrl: DEMO_VIDEO_URL,
    duration: DEMO_DURATION,
    uploadDate: "2026-10-10",
  },
];

// Section order and copy follow LANDING.md. Privacy comes before the features on purpose.
// Everything below the hero renders lazily (see .lazy-section in globals.css), so the first screen paints sooner.
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <Hero />
      {/* Below the hero the page is always dark: near-black base with deep-green panels (see .section-dark). */}
      <div className="section-dark pb-3">
        <div className="lazy-section"><Privacy /></div>
        <div className="lazy-section"><Problem /></div>
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
