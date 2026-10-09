import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorks() {
  return (
    <Placeholder title="How it works">
      From a phone photo to a checked receipt: read on your laptop, checked against BIR rules, decided by your Reviewer.
    </Placeholder>
  );
}
