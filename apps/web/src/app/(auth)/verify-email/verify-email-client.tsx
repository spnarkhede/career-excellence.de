"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, FormError, Input, Label } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { apiClient } from "../../../lib/api-client";

type VerifyReason = "valid" | "expired" | "already_used" | "invalid" | "already_verified";
type Phase = "ready" | "missing_token" | "verifying" | "done" | "error";

const DEFAULT_REDIRECT = "/login";

function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (!next) return DEFAULT_REDIRECT;
  // Checklist item 14: "Verification redirect only to allowlisted internal paths
  // through the safe redirect helper" — never follow an attacker-supplied `next`.
  return isAllowedRedirect(next, [window.location.origin]) ? next : DEFAULT_REDIRECT;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [reason, setReason] = useState<VerifyReason | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Capture the token on mount, then immediately strip it from the visible address
  // bar — checklist item 5: "token removed from the address bar after load." The
  // token itself is kept only in React state until the user explicitly confirms;
  // nothing is submitted automatically.
  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) {
      setPhase("missing_token");
      return;
    }
    setToken(t);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [searchParams]);

  async function handleConfirm() {
    if (!token) return;
    setPhase("verifying");
    try {
      const res = await apiClient.post<{ reason: VerifyReason }>("/auth/verify-email", { token });
      setReason(res.reason);
      setPhase("done");
    } catch {
      setReason("invalid");
      setPhase("done");
    }
  }

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResendMessage(null);
    try {
      await apiClient.post("/auth/resend-verification", { email: resendEmail });
    } catch (err) {
      // Even a validation error here must not distinguish known/unknown emails —
      // show the same neutral message either way.
      void err;
    }
    setResendMessage("If an account needs verification, a new link has been sent.");
  }

  if (phase === "missing_token") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Missing verification link</h1>
        <p className="text-muted-foreground">This link is missing its verification token.</p>
      </div>
    );
  }

  if (phase === "ready" || phase === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Confirm your email</h1>
        <p className="text-muted-foreground">Click below to finish verifying your email address.</p>
        <Button onClick={() => void handleConfirm()} disabled={phase === "verifying"}>
          {phase === "verifying" ? "Confirming…" : "Confirm email"}
        </Button>
      </div>
    );
  }

  // phase === "done" — render per-reason state with its recovery action. None of
  // these reveal whether any particular email is registered — they describe the
  // token's own state only (checklist item 6).
  const redirectTarget = resolveRedirectTarget(searchParams);

  if (reason === "valid") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Email verified</h1>
        <p className="text-muted-foreground">You can now sign in to your account.</p>
        <a href={redirectTarget} className="underline">
          Continue
        </a>
      </div>
    );
  }

  if (reason === "already_verified") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Already verified</h1>
        <p className="text-muted-foreground">This account's email is already verified.</p>
        <a href={DEFAULT_REDIRECT} className="underline">
          Go to login
        </a>
      </div>
    );
  }

  // "expired" | "already_used" | "invalid" — all offer the same recovery action.
  const titleByReason: Record<string, string> = {
    expired: "This link has expired",
    already_used: "This link has already been used",
    invalid: "This link is invalid",
  };

  return (
    <div className="flex flex-col gap-3 text-center">
      <h1 className="text-2xl font-semibold">{titleByReason[reason ?? "invalid"]}</h1>
      <p className="text-muted-foreground">Enter your email to receive a new verification link.</p>
      <form onSubmit={(e) => void handleResend(e)} className="flex flex-col gap-3 text-left">
        <Label htmlFor="resend-email">Email</Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          required
        />
        <Button type="submit">Resend verification link</Button>
      </form>
      <FormError message={resendMessage ?? undefined} />
    </div>
  );
}

export function VerifyEmailClient() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
