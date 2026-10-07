"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormError, Input, Label } from "@saas/ui";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

/** Checklist 4.4/4.5 ("Facebook: ... ask the user for an email and verify
 * it"; "Microsoft: do not trust the email claim"): the provider identity was
 * real, but this app needs its own verified email before creating or linking
 * an account from it. Two steps: submit an email, then confirm the code sent
 * to it — same shape as the Phase 6 OTP flow. */
function PendingEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lookupToken = searchParams.get("token") ?? "";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/auth/oauth/pending/submit-email", { lookupToken, email });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post<{ ok: boolean }>("/auth/oauth/pending/verify", {
        lookupToken,
        code,
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError("That code didn't work. Please try again.");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!lookupToken) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Missing link</h1>
        <p className="text-muted-foreground">Please start sign-in again.</p>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={(e) => void submitEmail(e)} className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">One more step</h1>
        <p className="text-muted-foreground text-sm">
          We need a verified email address to finish signing you in.
        </p>
        <FormError message={error ?? undefined} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void verifyCode(e)} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Enter your code</h1>
      <p className="text-muted-foreground text-sm">We sent a 6-digit code to {email}.</p>
      <FormError message={error ?? undefined} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>
      <Button type="submit" disabled={submitting || code.length !== 6}>
        {submitting ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}

export function OAuthPendingEmailClient() {
  return (
    <Suspense>
      <PendingEmailContent />
    </Suspense>
  );
}
