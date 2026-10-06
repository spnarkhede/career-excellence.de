import type { ApiError } from "@saas/contracts";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.message);
    this.name = "ApiClientError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Called when the server returns 401 so the caller can trigger a refresh-and-retry or redirect to login. */
  onUnauthorized?: () => void;
}

/**
 * Thin typed fetch wrapper shared by apps/web and apps/admin. Always sends
 * credentials so the HttpOnly session cookie is included; never reads tokens
 * from JavaScript-accessible storage.
 */
export function createApiClient({ baseUrl, onUnauthorized }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (response.status === 401) {
      onUnauthorized?.();
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiError | null;
      throw new ApiClientError(
        response.status,
        body ?? {
          requestId: "unknown",
          code: "UNKNOWN_ERROR",
          message: "An unexpected error occurred.",
        },
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: "GET" }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
