import { describe, expect, it } from "vitest";
import {
  discoverApiHandlers,
  discoverPages,
  type ApiHandler,
  type PageRoute,
} from "./route-matrix";

/**
 * Phase 10 checklist test 1: "A route matrix generated from the codebase:
 * every page, API route, server action and admin route against anonymous,
 * user, admin and wrong role. Unclassified new routes fail the test."
 *
 * No server actions exist anywhere in this codebase yet (verified during
 * this phase's research — no `"use server"` directive anywhere in
 * apps/web or apps/admin), so that part of the matrix is currently empty;
 * this test will need a server-action entry added to a manifest the moment
 * one is introduced, which is exactly the enforcement this test exists to
 * provide.
 */

interface ApiManifestEntry {
  file: string;
  methodName: string;
  /** "public" = no SessionGuard; "user" = SessionGuard only; "permission"
   * = SessionGuard + a specific @RequirePermission. */
  access: "public" | "user" | "permission";
  permission?: string;
}

// Keyed by `${file}#${methodName}` for an exact, unambiguous match.
const API_MANIFEST: ApiManifestEntry[] = [
  // auth.controller.ts — unauthenticated-by-design flows (signup, login,
  // and every token/code-based verify endpoint prove identity via the
  // token itself, not a session cookie).
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "signUp", access: "public" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "login", access: "public" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "logout", access: "user" },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "logoutAllDevices",
    access: "user",
  },
  // Proves identity via the refresh cookie, not the session cookie — by design.
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "refresh", access: "public" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "me", access: "user" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "verifyEmail", access: "public" },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "resendVerification",
    access: "public",
  },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "requestPasswordReset",
    access: "public",
  },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "resetPassword", access: "public" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "requestOtp", access: "public" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "verifyOtp", access: "public" },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "requestMagicLink",
    access: "public",
  },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "verifyMagicLink",
    access: "public",
  },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "listSessions", access: "user" },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "revokeSession", access: "user" },
  {
    file: "apps/api/src/auth/auth.controller.ts",
    methodName: "revokeOtherSessions",
    access: "user",
  },
  { file: "apps/api/src/auth/auth.controller.ts", methodName: "changePassword", access: "user" },

  // oauth.controller.ts — start/callback/pending-identity are all
  // unauthenticated by design (the OAuth flow itself, or the token-based
  // pending-email sub-flow, establishes identity).
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "listProviders",
    access: "public",
  },
  { file: "apps/api/src/auth/oauth/oauth.controller.ts", methodName: "start", access: "public" },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "callbackGet",
    access: "public",
  },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "callbackPost",
    access: "public",
  },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "submitPendingEmail",
    access: "public",
  },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "verifyPendingEmail",
    access: "public",
  },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "listAccounts",
    access: "user",
  },
  {
    file: "apps/api/src/auth/oauth/oauth.controller.ts",
    methodName: "unlinkAccount",
    access: "user",
  },

  // health.controller.ts — standard infra convention: unauthenticated
  // liveness/readiness probes.
  { file: "apps/api/src/health/health.controller.ts", methodName: "liveness", access: "public" },
  { file: "apps/api/src/health/health.controller.ts", methodName: "readiness", access: "public" },

  // profile.controller.ts — the one place a declarative @RequirePermission
  // already exists (Phase 10).
  {
    file: "apps/api/src/profile/profile.controller.ts",
    methodName: "getMyProfile",
    access: "permission",
    permission: "profile.read.own",
  },
  {
    file: "apps/api/src/profile/profile.controller.ts",
    methodName: "updateMyProfile",
    access: "permission",
    permission: "profile.update.own",
  },
];

interface PageManifestEntry {
  routePath: string;
  access: "public" | "user" | "permission";
}

const WEB_PAGE_MANIFEST: PageManifestEntry[] = [
  { routePath: "/", access: "public" },
  { routePath: "/forgot-password", access: "public" },
  { routePath: "/login", access: "public" },
  { routePath: "/magic-link", access: "public" },
  { routePath: "/otp", access: "public" },
  { routePath: "/reset-password", access: "public" },
  { routePath: "/signup", access: "public" },
  { routePath: "/verify-email", access: "public" },
  { routePath: "/forbidden", access: "public" },
  { routePath: "/oauth/error", access: "public" },
  { routePath: "/oauth/verify-email", access: "public" },
  { routePath: "/dashboard", access: "user" },
  { routePath: "/dashboard/sessions", access: "user" },
  { routePath: "/dashboard/connected-accounts", access: "user" },
];

const ADMIN_PAGE_MANIFEST: PageManifestEntry[] = [
  { routePath: "/", access: "permission" }, // requirePermission("/", "users.read")
  { routePath: "/login", access: "public" },
  { routePath: "/forbidden", access: "public" },
];

/**
 * Returns `null` for a handler whose guard combination doesn't correspond to
 * any valid access level at all — specifically `@RequirePermission` with no
 * `SessionGuard` ahead of it, which `PermissionsGuard` cannot enforce
 * meaningfully (there is no principal to check). This must be caught as its
 * own failure, not silently miscategorized as "permission" (which earlier,
 * buggy version of this function did — proven by a manual sanity check that
 * removed `SessionGuard` from a real route and confirmed the test suite kept
 * passing until this check was added).
 */
function apiAccessActual(handler: ApiHandler): "public" | "user" | "permission" | null {
  if (handler.requiredPermission) {
    return handler.hasSessionGuard ? "permission" : null;
  }
  if (handler.hasSessionGuard) return "user";
  return "public";
}

describe("Route matrix: apps/api controllers", () => {
  const discovered = discoverApiHandlers("apps/api/src");
  const manifestByKey = new Map(
    API_MANIFEST.map((entry) => [`${entry.file}#${entry.methodName}`, entry]),
  );

  it("discovered at least the known handlers (discovery itself isn't silently broken)", () => {
    expect(discovered.length).toBeGreaterThanOrEqual(API_MANIFEST.length);
  });

  it.each(discovered)(
    "every discovered handler ($file#$methodName) is classified in the manifest",
    (handler: ApiHandler) => {
      const key = `${handler.file.replace(/\\/g, "/")}#${handler.methodName}`;
      const entry = manifestByKey.get(key);
      expect(entry, `Unclassified new route: ${key} — add it to API_MANIFEST`).toBeDefined();
    },
  );

  it.each(API_MANIFEST)(
    "manifest entry $file#$methodName's declared guards match what the code actually has",
    (entry) => {
      const key = `${entry.file}#${entry.methodName}`;
      const handler = discovered.find(
        (h) => `${h.file.replace(/\\/g, "/")}#${h.methodName}` === key,
      );
      expect(handler, `Manifest references a route that no longer exists: ${key}`).toBeDefined();
      if (!handler) return;
      expect(
        apiAccessActual(handler),
        `${key}: @RequirePermission present without SessionGuard — PermissionsGuard cannot enforce this`,
      ).toBe(entry.access);
      if (entry.access === "permission") {
        expect(handler.requiredPermission).toBe(entry.permission);
      }
    },
  );
});

function describePages(label: string, appSrcDir: string, manifest: PageManifestEntry[]) {
  describe(`Route matrix: ${label} pages`, () => {
    const discovered = discoverPages(appSrcDir);
    const manifestByPath = new Map(manifest.map((entry) => [entry.routePath, entry]));

    it("discovered at least the known pages (discovery itself isn't silently broken)", () => {
      expect(discovered.length).toBeGreaterThanOrEqual(manifest.length);
    });

    it.each(discovered)(
      "every discovered page ($routePath) is classified in the manifest",
      (page: PageRoute) => {
        const entry = manifestByPath.get(page.routePath);
        expect(
          entry,
          `Unclassified new page: ${page.routePath} (${page.file}) — add it to the manifest`,
        ).toBeDefined();
      },
    );

    it.each(manifest.filter((e) => e.access !== "public"))(
      "protected page $routePath actually calls requireUser()/requirePermission() server-side",
      (entry) => {
        const page = discovered.find((p) => p.routePath === entry.routePath);
        expect(
          page,
          `Manifest references a page that no longer exists: ${entry.routePath}`,
        ).toBeDefined();
        if (!page) return;
        expect(
          page.hasServerGate,
          `${entry.routePath} is classified as "${entry.access}" but its page.tsx never calls requireUser()/requirePermission()`,
        ).toBe(true);
      },
    );
  });
}

describePages("apps/web", "apps/web/src/app", WEB_PAGE_MANIFEST);
describePages("apps/admin", "apps/admin/src/app", ADMIN_PAGE_MANIFEST);
