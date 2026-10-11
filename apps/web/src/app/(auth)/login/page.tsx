import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { LoginClient } from "./login-client";

// Phase 15 task 1: this page used to be a single "use client" file, which
// cannot export `metadata` at all — split into this thin server component
// (metadata only) + login-client.tsx (all the existing interactive
// behavior, unchanged), matching the split already used by
// verify-email/magic-link/reset-password/otp.
export const metadata: Metadata = buildPageMetadata({
  title: "Log In — Access Your App Platform Account Securely",
  description:
    "Log in to your App Platform account to access your dashboard, manage your profile, and continue right where you left off.",
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return <LoginClient />;
}
