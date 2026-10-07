import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 11 ("Frontend auth state and UI") checklist tests. Every test here
 * is written to actually run without a live Postgres/API — the pages under
 * test (login, signup, otp, forgot-password) are plain client components
 * that only call the API on submit, so axe/double-submit/button-reenable/
 * viewport tests mock the API at the browser's network layer
 * (`page.route`) and never need a real backend.
 *
 * Two tests (`cross-tab logout sync`, `hard refresh shows no flash for an
 * authenticated user`) genuinely need a reachable API with a real session,
 * because the root layout's `getServerSession()` call runs server-side, in
 * the Next.js process, not interceptable by `page.route` (which only
 * intercepts the BROWSER's own network calls) — the same category of
 * environment limitation documented for every DB-dependent backend test in
 * this workstream. They skip cleanly via `isApiReachable()` rather than
 * being faked as passing.
 */

const PUBLIC_AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/otp"];

async function isApiReachable(): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/health/live`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Every client-only auth page's /auth/me check now comes from the
 * AuthProvider's server-resolved initial state (no client fetch at all) —
 * but the ROOT LAYOUT still does its own server-side /auth/me call before
 * ever rendering these pages. Without a reachable API, that call rejects
 * and getServerSession() returns null (unauthenticated) rather than
 * throwing — so these pages render correctly as "unauthenticated" even
 * with no backend running. This is what makes the axe/double-submit/
 * button-reenable tests below runnable without one. */
test.describe("Phase 11: axe has no violations on every public auth page", () => {
  for (const path of PUBLIC_AUTH_PAGES) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("axe: /reset-password (missing-token state)", async ({ page }) => {
    await page.goto("/reset-password");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("axe: /verify-email (missing-token state)", async ({ page }) => {
    await page.goto("/verify-email");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

async function fillLoginForm(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("user@example.com");
  // { exact: true }: without it, Playwright's substring accessible-name
  // match also matches the "Show password" toggle button (its aria-label
  // contains "password" too) — a real two-match ambiguity, not a test bug
  // alone; the toggle's label could also be made more distinct, but the
  // button's own name is already clear on its own ("Show password").
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
}

test("double click on login submit sends exactly one request", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/auth/login", async (route) => {
    requestCount++;
    // Hold the response briefly so both rapid clicks land while the first
    // request is still in flight — the real-world race this guards against.
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  const button = page.getByRole("button", { name: /log in/i });
  await Promise.all([button.click(), button.click({ force: true })]);
  await page.waitForTimeout(500);
  expect(requestCount).toBe(1);
});

test("submit button re-enables after a failed login (500) and shows the error", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ requestId: "r1", code: "INTERNAL", message: "Server error." }),
    }),
  );
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  const button = page.getByRole("button", { name: /log in/i });
  await button.click();

  await expect(page.getByText("Server error.")).toBeVisible();
  await expect(button).toBeEnabled();
});

test("login error summary receives focus and announces via role=alert", async ({ page }) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "r1",
        code: "INVALID_CREDENTIALS",
        message: "Incorrect email or password.",
      }),
    }),
  );
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/login");
  await fillLoginForm(page);
  await page.getByRole("button", { name: /log in/i }).click();

  const summary = page.getByRole("alert").filter({ hasText: "Incorrect email or password." });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
});

test("password visibility toggle preserves the typed value and exposes aria-pressed", async ({
  page,
}) => {
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/login");

  const passwordField = page.getByLabel("Password", { exact: true });
  await passwordField.fill("sensitive-value-123");
  await expect(passwordField).toHaveAttribute("type", "password");

  const toggle = page.getByRole("button", { name: /show password/i });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();

  await expect(passwordField).toHaveAttribute("type", "text");
  await expect(passwordField).toHaveValue("sensitive-value-123");
  await expect(page.getByRole("button", { name: /hide password/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("login page works at a 360px viewport with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/login");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  // Checklist "inputs at least 16px font" — guards against iOS Safari's
  // auto-zoom-on-focus for any input under 16px, which breaks this exact
  // viewport-with-keyboard-open scenario.
  const fontSize = await page
    .getByLabel("Email")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test("full keyboard navigation reaches every control on the login form", async ({ page }) => {
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/login");

  await page.getByLabel("Email", { exact: true }).focus();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /show password/i })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /log in/i })).toBeFocused();
});

test.describe("tests requiring a reachable API (skip cleanly without one)", () => {
  test.beforeEach(async () => {
    test.skip(!(await isApiReachable()), "No reachable API in this environment — see FINDINGS.md.");
  });

  test("logout in one tab redirects a second tab showing the dashboard", async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto("/dashboard");
    await tabB.goto("/dashboard");
    await tabA.getByRole("button", { name: /log out/i }).click();
    await expect(tabB).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("hard refresh on the dashboard shows no flash of the login page for an authenticated user", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
    await page.reload();
    // If there were a flash, the login form would be the first thing
    // painted — asserting the dashboard's own content is visible
    // immediately after reload (no intermediate navigation) is the
    // practical proxy available without a visual-diffing harness.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  });
});
