"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { apiClient } from "../../../lib/api-client";

type Phase = "ready" | "missing_token" | "verifying" | "done" | "error";

const DEFAULT_REDIRECT = "/dashboard";

function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (!next) return DEFAULT_REDIRECT;
  return isAllowedRedirect(next, [window.location.origin]) ? next : DEFAULT_REDIRECT;
}

function MagicLinkContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");

  // Task 6: "Magic links open a confirm page that POSTs, so link scanners cannot
  // consume them." The token sits in the URL only long enough to be read into state,
  // then is stripped from the visible address bar — a GET made by a mail scanner
  // following the raw link never reaches a route that consumes the token, because
  // consumption only happens from the explicit POST triggered below by a real click.
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
      await apiClient.post("/auth/magic-link/verify", { token });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "missing_token") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Missing sign-in link</h1>
        <p className="text-muted-foreground">This link is missing its sign-in token.</p>
      </div>
    );
  }

  if (phase === "ready" || phase === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Confirm sign-in</h1>
        <p className="text-muted-foreground">Click below to finish signing in.</p>
        <Button onClick={() => void handleConfirm()} disabled={phase === "verifying"}>
          {phase === "verifying" ? "Signing in…" : "Confirm sign-in"}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const redirectTarget = resolveRedirectTarget(searchParams);
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Signed in</h1>
        <a href={redirectTarget} className="underline">
          Continue
        </a>
      </div>
    );
  }

  // phase === "error" — covers expired, already-used, and invalid tokens alike;
  // never reveals which, to stay enumeration-safe.
  return (
    <div className="flex flex-col gap-3 text-center">
      <h1 className="text-2xl font-semibold">This link no longer works</h1>
      <p className="text-muted-foreground">
        It may have expired or already been used. Request a new one from the login page.
      </p>
      <a href="/login" className="underline">
        Back to login
      </a>
    </div>
  );
}

export function MagicLinkClient() {
  return (
    <Suspense>
      <MagicLinkContent />
    </Suspense>
  );
}
