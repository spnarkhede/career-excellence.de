"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@saas/ui";

// Checklist "Callback failure" / "OAuth retry": one message per failure
// reason, each with a retry path — never a raw provider error string.
const MESSAGES: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  state_missing: "Your sign-in session expired or this link was already used. Please try again.",
  state_mismatch: "We couldn't verify this sign-in attempt. Please try again.",
  missing_code: "The provider didn't return the expected response. Please try again.",
  exchange_failed: "We couldn't complete sign-in with that provider. Please try again.",
  token_exchange_failed: "We couldn't complete sign-in with that provider. Please try again.",
  missing_id_token: "That provider didn't return the information we need. Please try again.", // secret-scan-ignore-line: error-code key, not a token value
  id_token_invalid: "We couldn't verify that provider's response. Please try again.",
  id_token_nonce_mismatch: "We couldn't verify that provider's response. Please try again.",
  issuer_tenant_mismatch: "We couldn't verify that provider's response. Please try again.",
  missing_oid: "That provider didn't return the information we need. Please try again.",
  userinfo_failed: "We couldn't load your profile from that provider. Please try again.",
  // Checklist "Email collision": deliberately specific, per this phase's own
  // spec — see docs/auth/FINDINGS.md for why this is NOT an enumeration bug.
  email_collision:
    "An account already exists with this email. Sign in to that account, then link this provider from your account settings.",
  identity_already_linked: "This provider account is already linked to a different account.",
  unverified_email: "That provider didn't confirm this email address, so it can't be linked yet.",
  link_session_missing: "Please sign in before linking a provider.",
  provider_not_configured: "That sign-in method isn't available right now.",
  last_sign_in_method:
    "Set a password or link another provider before removing your last sign-in method.",
};

function OAuthErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const message = MESSAGES[code] ?? "Something went wrong during sign-in. Please try again.";

  return (
    <div className="flex flex-col gap-3 text-center">
      <h1 className="text-2xl font-semibold">Sign-in didn't work</h1>
      <p className="text-muted-foreground">{message}</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => (window.location.href = "/login")}>Back to login</Button>
      </div>
    </div>
  );
}

export function OAuthErrorClient() {
  return (
    <Suspense>
      <OAuthErrorContent />
    </Suspense>
  );
}
