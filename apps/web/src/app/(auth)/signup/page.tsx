import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { SignUpClient } from "./signup-client";

// Phase 15 task 1: split from a single "use client" file (which can't
// export `metadata`) into this thin server component + signup-client.tsx,
// same pattern as login/page.tsx.
export const metadata: Metadata = buildPageMetadata({
  title: "Sign Up — Create Your Free New App Platform Account",
  description:
    "Create a free App Platform account to get started with secure authentication, authorization, and all the tools you need.",
  path: "/signup",
  noindex: true,
});

export default function SignUpPage() {
  return <SignUpClient />;
}
