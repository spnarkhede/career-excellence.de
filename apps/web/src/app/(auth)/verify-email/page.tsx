"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../../../lib/api-client";
import { ApiClientError } from "@saas/api-client";

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing a token.");
      return;
    }
    apiClient
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiClientError ? err.body.message : "Verification failed.");
      });
  }, [searchParams]);

  if (status === "pending") return <p>Verifying your email…</p>;
  if (status === "success")
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Email verified</h1>
        <p className="text-muted-foreground">You can now log in to your account.</p>
      </div>
    );
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Verification failed</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  );
}
