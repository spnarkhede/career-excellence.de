import type { Metadata } from "next";
import { VerifyEmailClient } from "./verify-email-client";

// Checklist item 5: "Referrer Policy no referrer on that page" — the verification
// token sits in this page's own URL; a referrer header on any outbound request from
// here (an image, an analytics beacon, a clicked link) would leak it to a third party.
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
