"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ErrorSummary, Input, Label } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { ApiClientError, ApiClientOfflineError, ApiClientTimeoutError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";
import { useAuth } from "../../../components/auth-provider";

const DEFAULT_REDIRECT = "/dashboard";
// Matches the backend's cooldown (AuthService.OTP_RESEND_COOLDOWN_MS); shown so the
// user isn't left guessing why "Resend" is disabled (task 4: "cooldown shown in the
// UI"). If the backend value ever changes, this is purely cosmetic — the server is
// still the sole enforcement point.
const RESEND_COOLDOWN_SECONDS = 30;

function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (!next || !isAllowedRedirect(next, [window.location.origin])) return DEFAULT_REDIRECT;
  return next;
}

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const summaryItems = formError
    ? [{ id: step === "request" ? "email" : "otp-code", message: formError }]
    : [];

  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post("/auth/otp/request", { email });
      setStep("verify");
      setCode("");
      setRequestMessage("If an account exists for this email, a code has been sent.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (cooldown > 0 || submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/auth/otp/request", { email });
      setRequestMessage("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      submitLock.current = false;
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post(
        "/auth/otp/verify",
        { email, code },
        { treatUnauthorizedAsOrdinaryError: true },
      );
      await auth.notifyLoggedIn();
      router.push(resolveRedirectTarget(searchParams));
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  function describeError(err: unknown): string {
    if (err instanceof ApiClientTimeoutError) return "That took too long. Please try again.";
    if (err instanceof ApiClientOfflineError) return err.message;
    if (err instanceof ApiClientError) return err.body.message;
    return "Something went wrong. Please try again.";
  }

  if (step === "request") {
    return (
      <form onSubmit={(e) => void requestCode(e)} className="flex flex-col gap-4" noValidate>
        <h1 className="text-2xl font-semibold">Sign in with a code</h1>
        <ErrorSummary ref={errorSummaryRef} items={summaryItems} />
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void verifyCode(e)} className="flex flex-col gap-4" noValidate>
      <h1 className="text-2xl font-semibold">Enter your code</h1>
      <p className="text-muted-foreground text-sm">We sent a 6-digit code to {email}.</p>
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />
      {requestMessage && !formError && (
        <p className="text-muted-foreground text-sm">{requestMessage}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otp-code">Code</Label>
        {/* Task 8: single input, autocomplete="one-time-code" (lets the browser/OS
            autofill an SMS/email code), inputMode="numeric" (numeric keypad on
            mobile), and native paste support — a plain text input already accepts a
            pasted 6-digit string with no extra handler needed. */}
        <Input
          id="otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || code.length !== 6}>
        {isSubmitting ? "Verifying…" : "Verify code"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        disabled={cooldown > 0}
        onClick={() => void resendCode()}
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </Button>
    </form>
  );
}

export function OtpClient() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}
