import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Reset Password — Choose a New App Platform Password",
    description:
      "Choose a new password for your App Platform account. This page is only valid for a limited time after you request a reset.",
    path: "/reset-password",
    noindex: true,
  }),
  // Checklist task 3: "Referrer Policy no referrer" — the reset token sits in
  // this page's own URL; a referrer header on any outbound request from here
  // would leak it to a third party. Same rationale as verify-email/magic-link.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
