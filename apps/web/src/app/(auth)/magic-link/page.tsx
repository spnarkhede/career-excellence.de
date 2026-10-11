import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { MagicLinkClient } from "./magic-link-client";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Magic Link — Sign In to Your App Platform Account Instantly",
    description:
      "Click the magic link we emailed you to sign in to your App Platform account instantly, with no password required at all.",
    path: "/magic-link",
    noindex: true,
  }),
  // Mirrors verify-email's rule: the token sits in this page's own URL, so a leaked
  // Referer header on any outbound request from here would leak it to a third party.
  referrer: "no-referrer",
};

export default function MagicLinkPage() {
  return <MagicLinkClient />;
}
