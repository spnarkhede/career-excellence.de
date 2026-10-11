import type { MetadataRoute } from "next";

// Phase 15 task 4, defense-in-depth: apps/admin is entirely private
// (every page requires authentication/permission — see
// apps/admin/src/lib/require-user.ts), and apps/admin/src/app/layout.tsx
// already sets a blanket `robots: { index: false, follow: false }` meta
// tag app-wide. This disallows the whole app for crawlers too; as with
// apps/web's robots.ts, this is advisory only — robots.txt is not a
// security control, the real access control is the server-side permission
// check on every page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
