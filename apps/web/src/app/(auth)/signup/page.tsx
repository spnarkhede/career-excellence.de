"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, FormError, Input, Label } from "@saas/ui";
import {
  estimatePasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
  type SignUpInput,
} from "@saas/validation";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

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
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });
  const password = watch("password") ?? "";
  const strength = estimatePasswordStrength(password);

  const onSubmit = async (values: SignUpInput) => {
    setFormError(null);
    try {
      await apiClient.post("/auth/signup", values);
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.body.message : "Something went wrong.");
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
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
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
          autoComplete="new-password"
          {...register("password")}
        />
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Sign up"}
      </Button>
    </form>
  );
}
