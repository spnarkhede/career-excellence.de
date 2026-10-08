"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, ErrorSummary, FormError, Input, Label, PasswordInput } from "@saas/ui";
import {
  estimatePasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
  type SignUpInput,
} from "@saas/validation";
import { ApiClientError } from "@saas/api-client";
import { track } from "@saas/analytics";
import { apiClient } from "../../../lib/api-client";
import { OAuthButtons } from "../../../components/oauth-buttons";

const STRENGTH_BAR_COLOR = [
  "bg-muted",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];

export default function SignUpPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Checklist "double submission": react-hook-form's `isSubmitting` already
  // disables the button, but a ref closes the gap against a second click
  // racing in before the first re-render (same pattern as login/otp).
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });
  const password = watch("password") ?? "";
  const strength = estimatePasswordStrength(password);

  const summaryItems = [
    ...(formError ? [{ id: "signup-form-error", message: formError }] : []),
    ...(errors.email ? [{ id: "email", message: errors.email.message! }] : []),
    ...(errors.password ? [{ id: "password", message: errors.password.message! }] : []),
    ...(errors.termsAccepted
      ? [{ id: "termsAccepted", message: errors.termsAccepted.message! }]
      : []),
  ];

  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError, errors.email, errors.password]);

  // Checklist task 5: "track signup started" — fires once per form view,
  // never containing the email/password the user is about to type.
  useEffect(() => track("signup_started"), []);

  const onSubmit = async (values: SignUpInput) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/auth/signup", values);
      // Reset only ever happens here, on SUCCESS (checklist "forms reset
      // only after success, never wiping input on error") — switching to
      // the "check your email" view makes the form unreachable anyway, but
      // never clears field values on a failed submit above.
      track("signup_completed");
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
    } finally {
      submitLock.current = false;
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a verification link to your email address. Follow it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        <p className="text-muted-foreground text-xs">
          {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters. Any characters allowed — no
          required mix of letters, numbers, or symbols.
        </p>
        {password.length > 0 && (
          <div className="flex flex-col gap-1" aria-hidden="true">
            <div className="flex h-1.5 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-full flex-1 rounded ${
                    i < strength.score ? STRENGTH_BAR_COLOR[strength.score] : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs">{strength.label}</span>
          </div>
        )}
        <FormError message={errors.password?.message} />
      </div>

      <div className="flex items-start gap-2">
        <input id="termsAccepted" type="checkbox" className="mt-1" {...register("termsAccepted")} />
        <Label htmlFor="termsAccepted" className="text-sm font-normal">
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            Privacy Policy
          </a>
          .
        </Label>
      </div>
      <FormError message={errors.termsAccepted?.message} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Sign up"}
      </Button>

      <OAuthButtons mode="login" />
    </form>
  );
}
