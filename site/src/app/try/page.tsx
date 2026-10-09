import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Try Tally" };

export default function TryTally() {
  return (
    <Placeholder title="Try Tally on your Mac">
      Install Tally from the public repo and check your own receipts, fully offline after the first setup.
    </Placeholder>
  );
}
