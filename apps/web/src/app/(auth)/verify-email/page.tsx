import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { VerifyEmailClient } from "./verify-email-client";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Verify Your Email — Confirm Your App Platform Address",
    description:
      "Confirm your email address to finish setting up your App Platform account and unlock full access to every feature today.",
    path: "/verify-email",
    noindex: true,
  }),
  // Checklist item 5: "Referrer Policy no referrer on that page" — the verification
  // token sits in this page's own URL; a referrer header on any outbound request from
  // here (an image, an analytics beacon, a clicked link) would leak it to a third party.
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
