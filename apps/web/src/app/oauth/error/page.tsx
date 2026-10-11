import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { OAuthErrorClient } from "./error-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign-In Error — Something Went Wrong with App Platform",
  description:
    "We couldn't complete your sign-in with that provider. Review the details below and try signing in to App Platform again.",
  path: "/oauth/error",
  noindex: true,
});

export default function OAuthErrorPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <OAuthErrorClient />
    </main>
  );
}
