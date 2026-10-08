"use client";

import { REOPEN_COOKIE_SETTINGS_EVENT } from "./cookie-consent-banner";

/** Checklist task 4: "a link to reopen settings" — dispatches a DOM event
 * the banner (mounted once, globally, in the root layout) listens for,
 * rather than lifting consent state into a shared store neither component
 * otherwise needs. */
export function Footer() {
  return (
    <footer className="border-border mt-auto border-t py-6 text-center text-sm">
      <nav aria-label="Legal" className="flex flex-wrap justify-center gap-4">
        <a href="/privacy" className="text-muted-foreground hover:text-foreground underline">
          Privacy policy
        </a>
        <a href="/terms" className="text-muted-foreground hover:text-foreground underline">
          Terms &amp; conditions
        </a>
        <a href="/contact" className="text-muted-foreground hover:text-foreground underline">
          Contact
        </a>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground underline"
          onClick={() => window.dispatchEvent(new CustomEvent(REOPEN_COOKIE_SETTINGS_EVENT))}
        >
          Cookie settings
        </button>
      </nav>
    </footer>
  );
}
