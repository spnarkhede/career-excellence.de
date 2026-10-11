import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { OAuthPendingEmailClient } from "./verify-email-client";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Confirm Your Email — Finish Your App Platform Sign-In",
    description:
      "We need to confirm your email address before finishing your App Platform sign-in through this provider. Check your inbox.",
    path: "/oauth/verify-email",
    noindex: true,
  }),
  referrer: "no-referrer",
};

export default function OAuthPendingEmailPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <OAuthPendingEmailClient />
    </main>
  );
}
