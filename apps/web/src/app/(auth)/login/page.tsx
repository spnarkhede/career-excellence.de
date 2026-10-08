"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, ErrorSummary, FormError, Label, PasswordInput, Input } from "@saas/ui";
import { resolveAuthRedirect } from "@saas/security";
import { loginSchema, type LoginInput } from "@saas/validation";
import { ApiClientError, ApiClientOfflineError, ApiClientTimeoutError } from "@saas/api-client";
import { track } from "@saas/analytics";
import { apiClient } from "../../../lib/api-client";
import { OAuthButtons } from "../../../components/oauth-buttons";
import { useAuth } from "../../../components/auth-provider";

// Checklist "Redirect after login" / "Incorrect redirect destination" /
// "Redirect rules that cannot loop": delegates to the same shared decision
// function `requireUser()` builds on (packages/security's
// resolveAuthRedirect) — this is the "signed in on login -> dashboard" half
// of the loop-free invariant; requireUser() is the other half.
function resolveRedirectTarget(searchParams: URLSearchParams): string {
  const { redirectTo } = resolveAuthRedirect({
    isLoginPage: true,
    requiresAuth: false,
    isAuthenticated: true,
    currentPath: "/login",
    next: searchParams.get("next"),
  });
  // isLoginPage + isAuthenticated always produces a non-null target per
  // resolveAuthRedirect's own (exhaustively tested) logic.
  return redirectTo!;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  // Belt-and-suspenders against a double submit: react-hook-form's `isSubmitting`
  // already disables the button while a submit is in flight, but a ref guards the
  // handler itself against a second invocation racing in before the first re-render
  // (checklist "Double-click login" / "Multiple simultaneous requests").
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Checklist "Existing session" / items 24-25 ("flash of protected content",
  // "flash of login page for authenticated users"): the session is already
  // known from the server (AuthProvider's initial state, resolved in the
  // root layout) — no client fetch, no loading flicker, no second round
  // trip. If it turns out we're already authenticated, redirect immediately.
  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(resolveRedirectTarget(searchParams));
    }
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Checklist "errors in an aria-live region, focus moved to an error
  // summary": built from both the form-level error and any field errors, and
  // the summary itself is focused right after a failed submit so a screen
  // reader announces everything wrong in one place.
  const summaryItems = [
    ...(formError ? [{ id: "login-form-error", message: formError }] : []),
    ...(errors.email ? [{ id: "email", message: errors.email.message! }] : []),
    ...(errors.password ? [{ id: "password", message: errors.password.message! }] : []),
  ];

  const onSubmit = async (values: LoginInput) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/auth/login", values, { treatUnauthorizedAsOrdinaryError: true });
      // The login response itself carries no principal (checklist "No tokens
      // in the response body when using cookies") — notifyLoggedIn()
      // re-resolves the session from the server and broadcasts to other
      // tabs before this page navigates on.
      await auth.notifyLoggedIn();
      track("login");
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

  // Moves focus to the error summary right after it appears — not on every
  // render, only when a NEW error shows up (checklist "focus moved to an
  // error summary").
  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError, errors.email, errors.password]);

  if (auth.status === "authenticated") {
    // Redirecting via the effect above — render nothing rather than a form
    // the user would never actually get to use.
    return (
      <p className="sr-only" aria-live="polite" role="status">
        Redirecting…
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <h1 className="text-2xl font-semibold">Log in</h1>
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="current-password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <span role="status" aria-label="Logging in">
            Logging in…
          </span>
        ) : (
          "Log in"
        )}
      </Button>

      <OAuthButtons mode="login" />
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
