import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyNotice() {
  return (
    <Placeholder title="Privacy notice">
      What we collect when you send an Early Access Request or Tester feedback, why, and how to ask us to delete it.
    </Placeholder>
  );
}
