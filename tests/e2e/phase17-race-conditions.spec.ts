import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Phase 17: race conditions and edge cases, browser-dependent scenarios.
 *
 * Helpers in this file (delayed route interception for "network throttling",
 * `context.setOffline` for offline/reconnect toggling, multiple `BrowserContext`s
 * for the "multiple devices" scenario, multiple `Page`s in one context for
 * "multiple tabs") are reused across the tests below rather than duplicated per
 * test, per this phase's task 1.
 *
 * Every test here mocks the API at the browser's network layer (`page.route`),
 * the same pattern already established in tests/e2e/auth-ui.spec.ts — none need
 * a reachable backend. Scenarios that genuinely cannot be exercised this way
 * (a real "browser closed mid-request," a real slow/flaky third-party OAuth
 * provider, a real multi-device session list) are documented as manual
 * verification in docs/auth/EDGE_CASES.md instead of faked here.
 */

async function fillLoginForm(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("user@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
}

/** Network-throttling helper (task 1): delays the given route's fulfillment by
 * `delayMs`, simulating a slow authentication provider or a slow network. */
async function delayRoute(
  page: Page,
  pattern: string,
  delayMs: number,
  body: unknown,
  status = 200,
) {
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status, body: JSON.stringify(body) });
  });
}

/** Opens a second tab (Page) in the SAME context, for "multiple browser tabs" tests. */
async function openSecondTab(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

// Checklist 12: Slow authentication provider.
test("slow login response keeps the submit button disabled and resolves exactly once", async ({
  page,
}) => {
  let loginCalls = 0;
  await page.route("**/auth/login", async (route) => {
    loginCalls++;
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  const button = page.getByRole("button", { name: /log in/i });
  await button.click();

  // The button must not be clickable again while the slow request is in flight
  // (same double-submit guard as the "duplicate clicks" test in auth-ui.spec.ts,
  // exercised here under a real multi-second delay rather than 300ms).
  await expect(button).toBeDisabled();
  await page.waitForTimeout(1700);
  expect(loginCalls).toBe(1);
});

// Checklist 10: Network disconnects during authentication.
test("submitting while offline shows a distinct offline message without hanging", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await fillLoginForm(page);
  await context.setOffline(true);

  await page.getByRole("button", { name: /log in/i }).click();

  // packages/api-client's ApiClientOfflineError fires before any fetch is even
  // attempted (navigator.onLine check) — the UI must surface this, not hang.
  await expect(page.getByText(/offline|check your connection/i)).toBeVisible({ timeout: 5000 });

  await context.setOffline(false);
});

// Checklist 11: Network reconnects — a retry after going back online succeeds.
test("retrying after reconnecting succeeds", async ({ page, context }) => {
  let loginCalls = 0;
  await page.route("**/auth/login", async (route) => {
    loginCalls++;
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByText(/offline|check your connection/i)).toBeVisible({ timeout: 5000 });

  await context.setOffline(false);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForTimeout(500);
  expect(loginCalls).toBe(1);
});

// Checklist 14: Rapid navigation — quickly navigating away from an in-flight auth
// page must not throw an unhandled error or leave a stuck loading state behind.
test("navigating away mid-request does not throw an unhandled page error", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  await delayRoute(page, "**/auth/login", 1000, { ok: true });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.goto("/signup");
  await page.goto("/forgot-password");
  await page.waitForTimeout(1200);

  expect(pageErrors).toEqual([]);
});

// Checklist 8: User refreshes during authentication — a hard reload mid-request
// must leave the app in a clean, non-half-authenticated state (no stuck spinner,
// no stale form resubmission), landing back on the login page unauthenticated.
test("reloading mid-login leaves the app in a clean unauthenticated state", async ({ page }) => {
  await delayRoute(page, "**/auth/login", 1000, { ok: true });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.reload();

  await expect(page.getByRole("button", { name: /log in/i })).toBeEnabled();
});

// Checklist 5: Multiple browser tabs — two tabs in the same context must each
// independently resolve their own auth state from the server rather than share
// client-side-only state (the one piece of cross-tab behavior that IS
// client-side, logout broadcast, is already covered by auth-ui.spec.ts's
// "cross-tab logout sync" test, which requires a reachable API).
test("two tabs in the same context each resolve their own unauthenticated state independently", async ({
  context,
}) => {
  await context.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  const tabA = await context.newPage();
  const tabB = await openSecondTab(context);

  await Promise.all([tabA.goto("/login"), tabB.goto("/login")]);
  await expect(tabA.getByRole("button", { name: /log in/i })).toBeVisible();
  await expect(tabB.getByRole("button", { name: /log in/i })).toBeVisible();

  await tabA.close();
  await tabB.close();
});
