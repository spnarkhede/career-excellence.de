import type { Metadata } from "next";
import { MagicLinkClient } from "./magic-link-client";

// Mirrors verify-email's rule: the token sits in this page's own URL, so a leaked
// Referer header on any outbound request from here would leak it to a third party.
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function MagicLinkPage() {
  return <MagicLinkClient />;
}
