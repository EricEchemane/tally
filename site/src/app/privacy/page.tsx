import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Privacy & security" };

export default function PrivacyAndSecurity() {
  return (
    <Placeholder title="Privacy & security">
      Your receipts never leave the laptop: what runs where, and how we prove there is no cloud.
    </Placeholder>
  );
}
