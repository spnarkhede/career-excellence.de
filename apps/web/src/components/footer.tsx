"use client";

import { REOPEN_COOKIE_SETTINGS_EVENT } from "./cookie-consent-banner";

/** Checklist task 4: "a link to reopen settings" — dispatches a DOM event
 * the banner (mounted once, globally, in the root layout) listens for,
 * rather than lifting consent state into a shared store neither component
 * otherwise needs. */
export function Footer() {
  return (
    <footer className="border-border mt-auto border-t py-6 text-center text-sm">
      {/* Phase 16 task 5: each item below is inline-flex with a min-h of
          24px (WCAG 2.5.8) — these are standalone nav controls, not links
          embedded in a sentence, so they don't qualify for the "inline
          text" exemption; `text-sm`'s line-height alone was ~20px. */}
      <nav aria-label="Legal" className="flex flex-wrap justify-center gap-4">
        <a
          href="/privacy"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center underline"
        >
          Privacy policy
        </a>
        <a
          href="/terms"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center underline"
        >
          Terms &amp; conditions
        </a>
        <a
          href="/contact"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center underline"
        >
          Contact
        </a>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center underline"
          onClick={() => window.dispatchEvent(new CustomEvent(REOPEN_COOKIE_SETTINGS_EVENT))}
        >
          Cookie settings
        </button>
      </nav>
    </footer>
  );
}
