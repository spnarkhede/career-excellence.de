import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  ApiClientOfflineError,
  ApiClientTimeoutError,
  broadcastLogout,
  createApiClient,
  onLogoutBroadcast,
} from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createApiClient", () => {
  it("resolves with the parsed JSON body on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ hello: "world" }),
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    expect(await client.get("/thing")).toEqual({ hello: "world" });
  });

  // Checklist "Server error" / general non-2xx handling.
  it("throws ApiClientError with the server's error body on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ requestId: "r1", code: "VALIDATION_FAILED", message: "Bad input" }),
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    await expect(client.post("/thing", {})).rejects.toMatchObject({
      status: 422,
      body: { code: "VALIDATION_FAILED", message: "Bad input" },
    });
  });

  // Checklist "Invalid response": the server returned a non-2xx with a body that
  // isn't valid JSON (or no body at all) — must not throw an unrelated parse error.
  it("falls back to a generic error body when the error response isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    const error = await client.get("/thing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).body.code).toBe("UNKNOWN_ERROR");
  });

  it("calls onUnauthorized exactly when the response status is 401", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ requestId: "r1", code: "UNAUTHORIZED", message: "no" }),
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", onUnauthorized });
    await client.get("/thing").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  // Checklist "Timeout".
  it("throws ApiClientTimeoutError when the request exceeds the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", timeoutMs: 5 });
    await expect(client.get("/slow")).rejects.toBeInstanceOf(ApiClientTimeoutError);
  });

  // Checklist "Offline mode".
  it("throws ApiClientOfflineError without ever calling fetch when navigator.onLine is false", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { onLine: false });

    const client = createApiClient({ baseUrl: "http://api.test" });
    await expect(client.get("/thing")).rejects.toBeInstanceOf(ApiClientOfflineError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proceeds normally when navigator.onLine is true", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    await expect(client.delete("/thing")).resolves.toBeUndefined();
  });

  // Checklist "Network failure": fetch itself rejects (DNS failure, connection
  // refused, etc.) with a non-AbortError — must propagate as-is, not be swallowed or
  // misreported as a timeout.
  it("propagates a genuine network failure distinctly from a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const client = createApiClient({ baseUrl: "http://api.test" });
    const error = await client.get("/thing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(ApiClientTimeoutError);
  });

  // Checklist "Refresh race conditions" / "Concurrent refresh requests" / explicit
  // test: "5 parallel requests with an expired token cause exactly one refresh."
  it("triggers exactly one /auth/refresh call for 5 parallel 401s, and retries each original request once", async () => {
    let refreshCalls = 0;
    // The first fetch for any given path returns 401 (simulating "access token
    // just expired"); the retry that follows a successful refresh succeeds.
    const seenPaths = new Set<string>();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls++;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (!seenPaths.has(url)) {
        seenPaths.add(url);
        return { ok: false, status: 401, json: async () => ({ message: "expired" }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: url }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://api.test" });
    const results = await Promise.all([
      client.get("/a"),
      client.get("/b"),
      client.get("/c"),
      client.get("/d"),
      client.get("/e"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(5);
  });

  it("redirects to login (via onUnauthorized) when the refresh itself fails, without retrying forever", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ requestId: "r1", code: "UNAUTHORIZED", message: "no" }),
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", onUnauthorized });
    await client.get("/thing").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  // Checklist "Token exposure in URLs/localStorage/sessionStorage": the CSRF
  // token is the one non-HttpOnly auth-adjacent value by design (double-submit
  // pattern), and it's attached as a header, never appended to the URL.
  it("attaches the CSRF token as a header on state-changing requests when the cookie is present", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=abc123; other=xyz" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://api.test" });
    await client.post("/thing", { a: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("abc123");
  });

  it("does not attach a CSRF header on a safe (GET) request", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=abc123" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://api.test" });
    await client.get("/thing");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  });
});

// Checklist "Cross-tab synchronization": notify other tabs with BroadcastChannel,
// storage event fallback.
describe("broadcastLogout / onLogoutBroadcast", () => {
  it("delivers a broadcastLogout() call to a subscriber via BroadcastChannel", () => {
    const listeners: Array<(event: unknown) => void> = [];
    class FakeBroadcastChannel {
      onmessage: ((event: unknown) => void) | null = null;
      postMessage(message: unknown) {
        for (const listener of listeners) listener({ data: message });
        if (this.onmessage) this.onmessage({ data: message });
      }
      close() {}
    }
    // Every instance shares the same `listeners` array so postMessage from one
    // instance reaches onmessage registered on another — matching real
    // BroadcastChannel's cross-instance delivery within one process.
    const Patched = class extends FakeBroadcastChannel {
      constructor() {
        super();
        listeners.push((event) => this.onmessage?.(event));
      }
    };
    vi.stubGlobal("BroadcastChannel", Patched);

    const callback = vi.fn();
    const unsubscribe = onLogoutBroadcast(callback);
    broadcastLogout();
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("falls back to a storage-event ping when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const listeners: Record<string, Array<(e: { key?: string }) => void>> = {};
    vi.stubGlobal("addEventListener", (type: string, listener: (e: { key?: string }) => void) => {
      (listeners[type] ??= []).push(listener);
    });
    vi.stubGlobal("removeEventListener", () => {});
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });

    const callback = vi.fn();
    onLogoutBroadcast(callback);
    broadcastLogout();

    expect(setItem).toHaveBeenCalledWith("auth-logout-ping", expect.any(String));
    for (const listener of listeners.storage ?? []) {
      listener({ key: "auth-logout-ping" });
    }
    expect(callback).toHaveBeenCalledOnce();
  });
});
