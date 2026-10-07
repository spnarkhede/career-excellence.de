"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, ErrorSummary, FormError, Input, Label } from "@saas/ui";
import { requestPasswordResetSchema, type RequestPasswordResetInput } from "@saas/validation";
import { ApiClientError, ApiClientOfflineError, ApiClientTimeoutError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Checklist "double submission": a ref guard, same pattern as every other
  // form in this app, closing the gap react-hook-form's own `isSubmitting`
  // leaves against a second click racing in before the first re-render.
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  const summaryItems = [
    ...(formError ? [{ id: "forgot-password-form-error", message: formError }] : []),
    ...(errors.email ? [{ id: "email", message: errors.email.message! }] : []),
  ];

  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError, errors.email]);

  const onSubmit = async (values: RequestPasswordResetInput) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/auth/password-reset/request", values);
      setSent(true); // Always show the same neutral confirmation.
    } catch (err) {
      // A genuine network/timeout failure is shown distinctly from the
      // always-neutral "sent" response above — this is a transport failure,
      // not an enumeration-safety concern, since nothing about the message
      // below depends on whether the email is registered.
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

  if (sent) {
    return (
      <p className="text-muted-foreground text-center" role="status" aria-live="polite">
        If an account exists for that email, a reset link has been sent.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        {/* BUG (found and fixed this phase): autoComplete="email" was
            missing entirely, and `<FormError />` was rendered with no
            `message` prop (always null, dead code) — see FINDINGS.md. */}
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
