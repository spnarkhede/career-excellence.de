"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, FormError, Input, Label } from "@saas/ui";
import { isAllowedRedirect } from "@saas/security";
import { loginSchema, type LoginInput } from "@saas/validation";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      await apiClient.post("/auth/login", values);
      const next = searchParams.get("next");
      const destination =
        next && isAllowedRedirect(next, [window.location.origin]) ? next : "/dashboard";
      router.push(destination);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.body.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  };

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
