import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

// No next/font/google: it downloads fonts from the internet, and Tally must run offline.

export const metadata: Metadata = {
  title: "Tally",
  description: "Every receipt checked against BIR rules, on your own laptop.",
};

// viewportFit: the phone capture page pads its bottom bar by the safe area (home indicator).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
