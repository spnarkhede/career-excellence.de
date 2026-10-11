import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../lib/env";
import { CookieConsentBanner } from "../components/cookie-consent-banner";
import { AnalyticsBootstrap } from "../components/analytics-bootstrap";
import { AuthProvider } from "../components/auth-provider";
import { Footer } from "../components/footer";
import { getServerSession } from "../lib/session";
import { SITE_NAME, siteUrl } from "../lib/seo";

// Phase 15 task 1/2: every field here is a FALLBACK — every public page sets
// its own complete title/description/OG/Twitter via `buildPageMetadata()`
// (apps/web/src/lib/seo.ts), so this only matters for a route that forgets
// to (or genuinely has nothing more specific to say, e.g. a thrown error
// boundary). `metadataBase` is what lets every page's relative canonical/OG
// URL resolve to an absolute one (checklist task 1 "canonical URLs",
// task 2 "absolute URLs").
export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "A secure, product-neutral SaaS starter platform.",
  metadataBase: new URL(siteUrl()),
};

// `themeColor` moved out of `metadata` into its own `viewport` export —
// Next.js 14+ removed it from the Metadata type entirely; declaring it
// there is a silent no-op, not just a deprecation warning.
export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 11 task 1: resolved here, on the server, so every page's first
  // paint already carries the real auth state — see
  // apps/web/src/lib/session.ts and apps/web/src/components/auth-provider.tsx.
  const initialPrincipal = await getServerSession();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider initialPrincipal={initialPrincipal}>
          <div className="flex-1">{children}</div>
          <Footer />
          <CookieConsentBanner />
          <AnalyticsBootstrap />
        </AuthProvider>
      </body>
    </html>
  );
}
