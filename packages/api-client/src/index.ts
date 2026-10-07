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

/** Thrown for a client-side timeout (checklist "Timeout") — distinct from a server
 * error response, since no response was ever received to map a status code from. */
export class ApiClientTimeoutError extends Error {
  constructor() {
    super("The request took too long. Please try again.");
    this.name = "ApiClientTimeoutError";
  }
}

/** Thrown when the browser reports itself offline before a request is even attempted
 * (checklist "Offline mode") — avoids waiting for a fetch to fail/time out when we
 * already know it will. */
export class ApiClientOfflineError extends Error {
  constructor() {
    super("You appear to be offline. Check your connection and try again.");
    this.name = "ApiClientOfflineError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Called when the server returns 401 so the caller can trigger a refresh-and-retry or redirect to login. */
  onUnauthorized?: () => void;
  /** Default request timeout in ms (checklist "Timeout"). Per-call override via RequestOptions.timeoutMs. */
  timeoutMs?: number;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Thin typed fetch wrapper shared by apps/web and apps/admin. Always sends
 * credentials so the HttpOnly session cookie is included; never reads tokens
 * from JavaScript-accessible storage.
 */
export function createApiClient({ baseUrl, onUnauthorized, timeoutMs }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    // Checklist "Offline mode": fail fast and distinguishably, without ever touching
    // the network, when the browser already knows it has none. `navigator` is absent
    // in non-browser test/SSR contexts, where this check is simply skipped.
    // This package has no DOM lib in its tsconfig (it's shared by server and client
    // code alike), so `navigator` is accessed structurally rather than via the global
    // `Navigator` type.
    const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
    if (nav?.onLine === false) {
      throw new ApiClientOfflineError();
    }

    const controller = new AbortController();
    const effectiveTimeout = init.timeoutMs ?? timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiClientTimeoutError();
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

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
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "GET" }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, {
        ...options,
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, {
        ...options,
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
      }),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
