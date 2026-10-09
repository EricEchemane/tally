import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// Self-hosted at build time by next/font: visitors' browsers never call Google.
// Hanken Grotesk carries every text role (clean, warm, holds up from body to display); Geist Mono is kept only for
// figures (pesos, TINs), where columns of digits must line up.
// Hanken has no peso sign (₱); the Peso component sets it in Geist Mono wherever it appears in running text.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Tally: every receipt checked against BIR rules, on your own laptop",
  description:
    "Tally reads each receipt in a Liquidation, checks it against the BIR rules and shows what needs your attention. It runs on your Mac; nothing goes to the cloud.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${geistMono.variable} h-full antialiased`}>
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
