import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  ApiClientOfflineError,
  ApiClientTimeoutError,
  createApiClient,
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
});
