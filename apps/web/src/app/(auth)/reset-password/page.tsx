import type { Metadata } from "next";
import { ResetPasswordClient } from "./reset-password-client";

// Checklist task 3: "Referrer Policy no referrer" — the reset token sits in
// this page's own URL; a referrer header on any outbound request from here
// would leak it to a third party. Same rationale as verify-email/magic-link.
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
