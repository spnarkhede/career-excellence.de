import type { Metadata } from "next";

// Phase 15 task 4: "Auth, account, dashboard and API pages get a noindex
// meta tag." Set once at the layout level (same pattern apps/admin already
// uses app-wide) so it covers every current and future page under
// /dashboard without needing a per-page edit. robots.ts's disallow entry
// for /dashboard is defense-in-depth for crawlers that ignore meta tags —
// robots.txt itself is not a security control (task 4); the actual access
// control is requireUser() on every dashboard page, server-side.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
