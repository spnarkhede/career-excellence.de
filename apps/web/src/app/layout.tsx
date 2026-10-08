import type { Metadata } from "next";
import "./globals.css";
import "../lib/env";
import { CookieConsentBanner } from "../components/cookie-consent-banner";
import { AnalyticsBootstrap } from "../components/analytics-bootstrap";
import { AuthProvider } from "../components/auth-provider";
import { Footer } from "../components/footer";
import { getServerSession } from "../lib/session";

export const metadata: Metadata = {
  title: { default: "App Platform", template: "%s | App Platform" },
  description: "A secure, product-neutral SaaS starter platform.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
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
