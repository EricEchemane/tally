import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// Self-hosted at build time by next/font: visitors' browsers never call Google.
// Hanken Grotesk carries body and UI text (clean, warm); Bricolage Grotesque gives headings their voice; Geist Mono is kept only for
// figures (pesos, TINs), where columns of digits must line up.
// Hanken has no peso sign (₱); the Peso component sets it in Geist Mono wherever it appears in running text.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Display voice for headings, after the chunky headline in the Paynex reference (image.png).
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Tally",
  description:
    "Tally reads each receipt in a Liquidation, checks it against the BIR rules and shows what needs your attention. It runs on your Mac or Windows computer; nothing goes to the cloud.",
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
