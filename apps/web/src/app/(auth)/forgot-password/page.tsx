"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, FormError, Input, Label } from "@saas/ui";
import { requestPasswordResetSchema, type RequestPasswordResetInput } from "@saas/validation";
import { apiClient } from "../../../lib/api-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RequestPasswordResetInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  const onSubmit = async (values: RequestPasswordResetInput) => {
    await apiClient.post("/auth/password-reset/request", values);
    setSent(true); // Always show the same neutral confirmation.
  };

  if (sent) {
    return (
      <p className="text-muted-foreground text-center">
        If an account exists for that email, a reset link has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        <FormError />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
