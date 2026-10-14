/** @vitest-environment jsdom */
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ principal: null }),
    post: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Trivial consumer — AuthProvider is never rendered without at least one
 * descendant reading the context in real usage. */
function Consumer() {
  useAuth();
  return null;
}

afterEach(() => cleanup());

/**
 * Phase 18 task 7 / checklist item 13 ("memory leaks"): every listener this
 * component registers (the cross-tab login/logout broadcast subscriptions in
 * `packages/api-client`) must be torn down on unmount — mounting and
 * unmounting repeatedly must not leave a growing number of "storage"
 * listeners on `window` (the fallback path `onBroadcast` uses when
 * `BroadcastChannel` isn't available, which is also the one surface every
 * environment — jsdom included — is guaranteed to support, making it the
 * reliable signal to assert on regardless of whether this jsdom version
 * implements `BroadcastChannel` itself).
 */
describe("AuthProvider: no listener leak across repeated mount/unmount", () => {
  it("ends with the same window 'storage' listener count it started with, after 20 mount/unmount cycles", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const countStorageListeners = (spy: typeof addSpy) =>
      spy.mock.calls.filter(([type]) => type === "storage").length;

    for (let i = 0; i < 20; i++) {
      const { unmount } = render(
        <AuthProvider initialPrincipal={null}>
          <Consumer />
        </AuthProvider>,
      );
      unmount();
    }

    // Every "storage" listener this component's lifetime ever added must have
    // a matching removal — net outstanding listeners is zero, not merely
    // "didn't crash." A real leak here would show `added > removed` growing
    // linearly with the loop count (20), not staying equal to it.
    const added = countStorageListeners(addSpy);
    const removed = countStorageListeners(removeSpy);
    expect(added).toBeGreaterThan(0); // sanity: the subscription path actually ran
    expect(removed).toBe(added);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
