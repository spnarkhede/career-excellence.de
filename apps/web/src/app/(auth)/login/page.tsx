"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, FormError, Input, Label } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { loginSchema, type LoginInput } from "@saas/validation";
import { ApiClientError, ApiClientOfflineError, ApiClientTimeoutError } from "@saas/api-client";
import type { AuthenticatedPrincipal } from "@saas/types";
import { apiClient } from "../../../lib/api-client";

const DEFAULT_REDIRECT = "/dashboard";

function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const next = searchParams.get("next");
  // Checklist "Redirect after login" / "Incorrect redirect destination": only ever
  // follow an allowlisted, same-origin path — never an attacker-supplied `next`.
  if (!next || !isAllowedRedirect(next, [window.location.origin])) return DEFAULT_REDIRECT;
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  // Belt-and-suspenders against a double submit: react-hook-form's `isSubmitting`
  // already disables the button while a submit is in flight, but a ref guards the
  // handler itself against a second invocation racing in before the first re-render
  // (checklist "Double-click login" / "Multiple simultaneous requests").
  const submitLock = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Checklist "Existing session": a signed-in user visiting /login is sent straight
  // to the dashboard rather than shown the form again. The auth state is read from
  // the server (GET /auth/me), never assumed from e.g. cookie presence alone.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ principal: AuthenticatedPrincipal }>("/auth/me")
      .then(() => {
        if (!cancelled) router.replace(resolveRedirectTarget(searchParams));
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount only — searchParams/router are read for their
    // current value at that moment, not re-triggered on every param change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: LoginInput) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/auth/login", values);
      // Auth state is updated from the server's own response on the NEXT page (the
      // dashboard re-derives it via GET /auth/me) — this page never assumes success
      // implies a particular client-side auth state beyond "navigate on, and let the
      // destination ask the server."
      router.push(resolveRedirectTarget(searchParams));
    } catch (err) {
      if (err instanceof ApiClientTimeoutError) {
        setFormError("That took too long. Please try again.");
      } else if (err instanceof ApiClientOfflineError) {
        setFormError(err.message);
      } else if (err instanceof ApiClientError) {
        setFormError(err.body.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      submitLock.current = false;
    }
  };

  if (checkingSession) {
    return <p className="text-muted-foreground text-center">Loading…</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <FormError message={formError ?? undefined} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <FormError message={errors.password?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
