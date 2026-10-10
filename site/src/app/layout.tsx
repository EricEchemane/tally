import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_VIDEO_URL, SITE_URL } from "@/lib/links";

// Self-hosted at build time by next/font: visitors' browsers never call Google.
// Hanken Grotesk carries body and UI text (clean, warm); Bricolage Grotesque gives headings their voice; Geist Mono is kept only for
// figures (pesos, TINs), where columns of digits must line up.
// Hanken has no peso sign (₱); the Peso component sets it in Geist Mono wherever it appears in running text.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Display voice for headings, after the chunky headline in the Paynex reference (image.png).
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

const TITLE = "Tally: BIR receipt checker for liquidation reports, offline on your computer";
const DESCRIPTION =
  "Snap receipts with your phone and Tally checks each one in your cash advance liquidation against BIR rules, flags what needs a second look and exports the report. Private, offline AI that runs on your Mac or Windows PC; nothing goes to the cloud.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Tally" },
  description: DESCRIPTION,
  applicationName: "Tally",
  keywords: [
    "BIR receipt checker",
    "liquidation report Philippines",
    "cash advance liquidation",
    "check receipts BIR rules",
    "offline AI receipt scanner",
    "VAT receipt validation",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Tally",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_PH",
    videos: [{ url: DEMO_VIDEO_URL, type: "video/mp4", width: 1728, height: 1080 }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {/* Cookieless page views; no cookie banner needed. */}
        <Analytics />
      </body>
    </html>
  );
}
