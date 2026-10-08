"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, ErrorSummary, FormError, Input, Label } from "@saas/ui";
import { contactFormSchema, type ContactFormInput } from "@saas/validation";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../lib/api-client";

/**
 * Phase 14 task 9 ("spam protection on public forms"): the honeypot
 * (`website`) and `renderedAt` fields below are never shown to or filled
 * in by a real user — they're the anti-spam signals `ContactService`
 * checks server-side. Client-side validation (zod, via `zodResolver`) is
 * a UX convenience only; the server re-validates everything with the
 * SAME shared schema and is the authoritative check (checklist task 8:
 * "server authoritative").
 */
export function ContactClient() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({ resolver: zodResolver(contactFormSchema) });

  // Stamped once, when the form actually renders — the server rejects a
  // submission that arrives faster than a human could plausibly type a
  // message (checklist "minimum fill time").
  useEffect(() => {
    setValue("renderedAt", Date.now());
  }, [setValue]);

  const summaryItems = [
    ...(formError ? [{ id: "contact-form-error", message: formError }] : []),
    ...(errors.name ? [{ id: "name", message: errors.name.message! }] : []),
    ...(errors.email ? [{ id: "email", message: errors.email.message! }] : []),
    ...(errors.message ? [{ id: "message", message: errors.message.message! }] : []),
  ];

  useEffect(() => {
    if (summaryItems.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formError, errors.name, errors.email, errors.message]);

  const onSubmit = async (values: ContactFormInput) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setFormError(null);
    try {
      await apiClient.post("/contact", values);
      setSent(true);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
    } finally {
      submitLock.current = false;
    }
  };

  if (sent) {
    return (
      <p className="text-muted-foreground" role="status" aria-live="polite">
        Thanks — we&apos;ll get back to you soon.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <ErrorSummary ref={errorSummaryRef} items={summaryItems} />

      {/* Honeypot: hidden via CSS (off-screen), never `type="hidden"` or
          `display:none` alone — some bots specifically skip those. A real
          user never sees or tabs into this field; `aria-hidden` and
          `tabIndex={-1}` keep it out of the way for assistive tech too. */}
      <div
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">Leave this field blank</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        <FormError message={errors.name?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          rows={5}
          className="border-border bg-background flex w-full rounded-md border px-3 py-2 text-base"
          {...register("message")}
        />
        <FormError message={errors.message?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
