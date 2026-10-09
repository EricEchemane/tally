import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "FAQ" };

export default function Faq() {
  return (
    <Placeholder title="Frequently asked questions">
      EOPT, Invoices and Official Receipts, Mac requirements, Windows, and what the AI does and does not decide.
    </Placeholder>
  );
}
