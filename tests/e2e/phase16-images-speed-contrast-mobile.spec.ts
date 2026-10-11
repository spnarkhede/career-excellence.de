import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 16 ("Images, speed, contrast, mobile and links") checklist tests.
 *
 * Task 4 ("both light and dark themes"): this codebase has no dark theme
 * at all (confirmed: no `next-themes`, no `ThemeProvider`, no
 * `prefers-color-scheme` handling, no CSS custom properties with a dark
 * variant anywhere — `apps/web/src/app/globals.css` hardcodes
 * `color-scheme: light`). There is nothing to test in a "dark theme" that
 * doesn't exist; see docs/auth/FINDINGS.md for this documented scope
 * decision. Every test below verifies the one theme that actually exists.
 */

const VIEWPORTS = [
  { name: "360px (mobile)", width: 360, height: 740 },
  { name: "768px (tablet)", width: 768, height: 1024 },
  { name: "1280px (desktop)", width: 1280, height: 800 },
];

async function hasHorizontalOverflow(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.describe("Task 4: axe color-contrast checks (light theme — the only theme that exists)", () => {
  const PAGES_NOT_ALREADY_COVERED_BY_PHASE_11 = ["/", "/signup", "/contact", "/privacy", "/terms"];

  for (const path of PAGES_NOT_ALREADY_COVERED_BY_PHASE_11) {
    test(`axe (color-contrast enabled): ${path}`, async ({ page }) => {
      await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
      await page.goto(path);
      // Not filtered to color-contrast alone — a full `.analyze()` is the
      // same pattern Phase 11 already established, and it already includes
      // axe's default color-contrast rule among everything else checked.
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});

test.describe("Task 5: mobile responsiveness at 360/768/1280px", () => {
  const PAGES = ["/", "/login", "/signup", "/contact"];

  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`${path} at ${viewport.name}: no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
        await page.goto(path);
        expect(await hasHorizontalOverflow(page)).toBe(false);
      });
    }
  }
});

test.describe("Task 5: touch targets are at least 24x24 CSS pixels (WCAG 2.5.8)", () => {
  async function boundingBoxOf(locator: import("@playwright/test").Locator) {
    const box = await locator.boundingBox();
    expect(box, "element should be visible and have a bounding box").not.toBeNull();
    return box!;
  }

  test("the password-visibility toggle button meets the 24x24px minimum", async ({ page }) => {
    await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: /show password/i });
    const box = await boundingBoxOf(toggle);
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test("the signup terms-acceptance checkbox meets the 24x24px minimum", async ({ page }) => {
    await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/signup");
    const checkbox = page.getByRole("checkbox");
    const box = await boundingBoxOf(checkbox);
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test("footer nav links/buttons meet the 24px minimum height", async ({ page }) => {
    await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    for (const name of [/privacy policy/i, /terms/i, /contact/i, /cookie settings/i]) {
      const el = page.getByRole("link", { name }).or(page.getByRole("button", { name }));
      const box = await el.first().boundingBox();
      expect(box, `${name} should be visible`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe("Task 4 (BUG-028): keyboard focus is actually visible", () => {
  test("a focused button/input shows a visible focus ring (not just the native outline, which is explicitly suppressed)", async ({
    page,
  }) => {
    await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/login");

    await page.getByLabel("Email", { exact: true }).focus();
    const boxShadow = await page
      .getByLabel("Email", { exact: true })
      .evaluate((el) => getComputedStyle(el).boxShadow);
    // Tailwind's `ring` utilities render as a box-shadow; "none" would mean
    // BUG-028's bug is back (no color resolved for `ring-ring`).
    expect(boxShadow).not.toBe("none");
  });
});

test.describe("Task 1: image alt text", () => {
  test("every <img> on every checked page has an alt attribute", async ({ page }) => {
    // Belt-and-suspenders at runtime, alongside the eslint-plugin-jsx-a11y
    // `alt-text` rule (build-time) — there are no `<img>` elements in this
    // app today, so this trivially passes; it exists so the day one is
    // added, a missing alt is caught here too, not only at lint time.
    for (const path of ["/", "/login", "/signup", "/contact", "/privacy", "/terms"]) {
      await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
      await page.goto(path);
      const imagesWithoutAlt = await page.evaluate(
        () => document.querySelectorAll("img:not([alt])").length,
      );
      expect(imagesWithoutAlt).toBe(0);
    }
  });
});
