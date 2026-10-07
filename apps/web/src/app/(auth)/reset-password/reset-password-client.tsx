"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, ErrorSummary, FormError, Label, PasswordInput } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { resetPasswordSchema, type ResetPasswordInput } from "@saas/validation";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

type TokenErrorCode = "RESET_TOKEN_EXPIRED" | "RESET_TOKEN_USED" | "RESET_TOKEN_INVALID";
const TOKEN_ERROR_CODES = new Set<string>([
  "RESET_TOKEN_EXPIRED",
  "RESET_TOKEN_USED",
  "RESET_TOKEN_INVALID",
]);

const DEFAULT_REDIRECT = "/login";

function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  if (!next) return DEFAULT_REDIRECT;
  // Checklist "Redirect handling": only ever follow an allowlisted, same-origin
  // path — never an attacker-supplied `next`, same helper used by login/
  // verify-email/magic-link.
  return isAllowedRedirect(next, [window.location.origin]) ? next : DEFAULT_REDIRECT;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [missingToken, setMissingToken] = useState(false);
  const [tokenError, setTokenError] = useState<TokenErrorCode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Checklist "double submission" — same ref-guard pattern as every other
  // form in this app; this form was previously missing it.
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Omit<ResetPasswordInput, "token">>({
    resolver: zodResolver(resetPasswordSchema.omit({ token: true })),
  });

  const summaryItems = [
    ...(formError ? [{ id: "reset-password-form-error", message: formError }] : []),
    ...(errors.password ? [{ id: "password", message: errors.password.message! }] : []),
  ];

  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError, errors.password]);

  // Capture the token on mount, then strip it from the visible address bar —
  // same pattern as verify-email/magic-link (checklist task 3: "token removed
  // from the address bar after load").
  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) {
      setMissingToken(true);
      return;
    }
    setToken(t);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [searchParams]);

  const onSubmit = async (values: Omit<ResetPasswordInput, "token">) => {
    if (!token || submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    setTokenError(null);
    try {
      await apiClient.post("/auth/password-reset/confirm", { ...values, token });
      router.push(`${resolveRedirectTarget(searchParams)}?reason=password_reset`);
    } catch (err) {
      if (err instanceof ApiClientError && TOKEN_ERROR_CODES.has(err.body.code)) {
        setTokenError(err.body.code as TokenErrorCode);
        return;
      }
      setFormError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
    } finally {
      submitLock.current = false;
    }
  };

  if (missingToken) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Missing reset link</h1>
        <p className="text-muted-foreground">This link is missing its reset token.</p>
        <a href="/forgot-password" className="underline">
          Request a new link
        </a>
      </div>
    );
  }

  // Checklist task 6: a distinct "Request a new link" state for expired, used,
  // and invalid tokens alike — none of these reveal anything about the account,
  // only the token's own state (same enumeration-safe shape as verify-email).
  if (tokenError) {
    const titleByCode: Record<TokenErrorCode, string> = {
      RESET_TOKEN_EXPIRED: "This link has expired",
      RESET_TOKEN_USED: "This link has already been used",
      RESET_TOKEN_INVALID: "This link is invalid",
    };
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-semibold">{titleByCode[tokenError]}</h1>
        <p className="text-muted-foreground">Request a new link to reset your password.</p>
        <a href="/forgot-password" className="underline">
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting || !token}>
        {isSubmitting ? "Saving…" : "Reset password"}
      </Button>
    </form>
  );
}

export function ResetPasswordClient() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
