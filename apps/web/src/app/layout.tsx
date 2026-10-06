import type { Metadata } from "next";
import "./globals.css";
import "../lib/env";
import { CookieConsentBanner } from "../components/cookie-consent-banner";

export const metadata: Metadata = {
  title: { default: "App Platform", template: "%s | App Platform" },
  description: "A secure, product-neutral SaaS starter platform.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
