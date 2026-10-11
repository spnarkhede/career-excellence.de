import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { ForgotPasswordClient } from "./forgot-password-client";

// Phase 15 task 1: split from a single "use client" file (which can't
// export `metadata`) into this thin server component +
// forgot-password-client.tsx, same pattern as login/signup.
export const metadata: Metadata = buildPageMetadata({
  title: "Forgot Your Password — Reset Your App Platform Account",
  description:
    "Forgot your password? Enter your email and we will send you a link to reset your App Platform account password securely.",
  path: "/forgot-password",
  noindex: true,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
