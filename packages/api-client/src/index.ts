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
  /** Called when a 401 survives a refresh attempt (or no refresh was attempted),
   * so the caller can clear local state and redirect to login. */
  onUnauthorized?: () => void;
  /** Default request timeout in ms (checklist "Timeout"). Per-call override via RequestOptions.timeoutMs. */
  timeoutMs?: number;
  /** Cookie name(s) the double-submit CSRF token may be stored under, tried in
   * order — the __Host- prefix is applied server-side whenever the cookie is
   * Secure with no Domain attribute, which the client can't predict in advance,
   * so it just tries both. */
  csrfCookieNames?: string[];
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  /** Internal: set on the single automatic retry after a refresh, so that retry's
   * own 401 (if the refreshed session is somehow still rejected) doesn't trigger
   * a second refresh-and-retry loop. */
  __isRetry?: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CSRF_COOKIE_NAMES = ["__Host-csrf_token", "csrf_token"];
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Structural access to `document.cookie` — this package has no DOM lib in its
 * tsconfig (shared by server and client code alike), so browser globals are read
 * via `globalThis` casts rather than the ambient `Document`/`Window` types. */
function readCookie(names: string[]): string | null {
  const doc = (globalThis as { document?: { cookie?: string } }).document;
  if (!doc?.cookie) return null;
  for (const name of names) {
    const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(doc.cookie);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

const LOGOUT_BROADCAST_CHANNEL = "auth-logout";
const LOGOUT_STORAGE_KEY = "auth-logout-ping";

/** Notifies every other open tab/window that the user just logged out, so they can
 * clear their own in-memory auth state and redirect to login too (checklist
 * "notify other tabs with BroadcastChannel, storage event fallback"). Call this
 * right after a successful logout request. Best-effort: a browser that blocks
 * both BroadcastChannel and localStorage (e.g. some private-mode configurations)
 * just won't propagate — the tab that actually called logout is unaffected either
 * way, since it updates its own state directly. */
export function broadcastLogout(): void {
  const g = globalThis as {
    BroadcastChannel?: new (name: string) => {
      postMessage: (m: unknown) => void;
      close: () => void;
    };
    localStorage?: { setItem: (k: string, v: string) => void };
  };
  try {
    if (g.BroadcastChannel) {
      const channel = new g.BroadcastChannel(LOGOUT_BROADCAST_CHANNEL);
      channel.postMessage("logout");
      channel.close();
      return;
    }
  } catch {
    // fall through to the storage-event fallback below
  }
  try {
    g.localStorage?.setItem(LOGOUT_STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage can throw in some private-mode configurations — cross-tab sync
    // is best-effort, never load-bearing for the tab that called logout itself.
  }
}

/** Subscribes to logout broadcasts from other tabs. Returns an unsubscribe
 * function. Safe to call in a non-browser environment (no-op subscription). */
export function onLogoutBroadcast(callback: () => void): () => void {
  const g = globalThis as {
    BroadcastChannel?: new (name: string) => {
      onmessage: ((event: unknown) => void) | null;
      close: () => void;
    };
    addEventListener?: (type: string, listener: (event: { key?: string }) => void) => void;
    removeEventListener?: (type: string, listener: (event: { key?: string }) => void) => void;
  };

  let channel: { close: () => void } | undefined;
  try {
    if (g.BroadcastChannel) {
      const bc = new g.BroadcastChannel(LOGOUT_BROADCAST_CHANNEL);
      bc.onmessage = () => callback();
      channel = bc;
    }
  } catch {
    // ignore — storage fallback below still applies
  }

  const storageListener = (event: { key?: string }) => {
    if (event.key === LOGOUT_STORAGE_KEY) callback();
  };
  try {
    g.addEventListener?.("storage", storageListener);
  } catch {
    // non-browser environment — nothing to subscribe to
  }

  return () => {
    channel?.close();
    try {
      g.removeEventListener?.("storage", storageListener);
    } catch {
      // ignore
    }
  };
}

/**
 * Thin typed fetch wrapper shared by apps/web and apps/admin. Always sends
 * credentials so the HttpOnly session cookie is included; never reads tokens
 * from JavaScript-accessible storage. Automatically attaches the double-submit
 * CSRF token header on state-changing requests, and performs a single-flight
 * refresh-and-retry-once on a 401 (checklist: "one shared refresh promise, the
 * original request retried once").
 */
export function createApiClient({
  baseUrl,
  onUnauthorized,
  timeoutMs,
  csrfCookieNames = DEFAULT_CSRF_COOKIE_NAMES,
}: ApiClientOptions) {
  // Shared across every concurrent caller of this client instance: the first 401
  // to arrive starts the refresh and stores its promise here; every other 401
  // arriving before it settles awaits the SAME promise instead of starting its
  // own — exactly the "5 parallel requests... cause exactly one refresh" property.
  let refreshPromise: Promise<boolean> | null = null;

  function refreshOnce(): Promise<boolean> {
    if (!refreshPromise) {
      const csrfToken = readCookie(csrfCookieNames);
      refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      })
        .then((res) => res.ok)
        .catch(() => false)
        // Clear the shared promise once THIS refresh attempt settles, so a LATER,
        // unrelated 401 (e.g. the access token expiring again sometime later)
        // starts a fresh refresh rather than replaying a stale result forever.
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    // Checklist "Offline mode": fail fast and distinguishably, without ever touching
    // the network, when the browser already knows it has none. `navigator` is absent
    // in non-browser test/SSR contexts, where this check is simply skipped.
    const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
    if (nav?.onLine === false) {
      throw new ApiClientOfflineError();
    }

    const controller = new AbortController();
    const effectiveTimeout = init.timeoutMs ?? timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    const method = (init.method ?? "GET").toUpperCase();
    const csrfToken = STATE_CHANGING_METHODS.has(method) ? readCookie(csrfCookieNames) : null;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
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
      const isRefreshEndpoint = path === "/auth/refresh";
      if (!isRefreshEndpoint && !init.__isRetry) {
        const refreshed = await refreshOnce();
        if (refreshed) {
          return request<T>(path, { ...init, __isRetry: true });
        }
      }
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
