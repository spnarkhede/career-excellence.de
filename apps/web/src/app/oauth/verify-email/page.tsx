import type { Metadata } from "next";
import { OAuthPendingEmailClient } from "./verify-email-client";

export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function OAuthPendingEmailPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <OAuthPendingEmailClient />
    </main>
  );
}
