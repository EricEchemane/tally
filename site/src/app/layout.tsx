import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    template: "%s · Tally PH liquidation review",
    default: "Tally PH: BIR-checked liquidation review, offline",
  },
  description:
    "Tally PH checks every cash advance receipt against BIR rules on your own laptop: Official Receipts, missing TINs and out-of-period spend, with no cloud.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {/* Cookieless page views; no cookie banner needed. */}
        <Analytics />
      </body>
    </html>
  );
}
