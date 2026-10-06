import { createApiClient } from "@saas/api-client";

export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  onUnauthorized: () => {
    if (typeof window !== "undefined") {
      window.location.href = "/login?reason=session_expired";
    }
  },
});
