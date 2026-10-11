import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/seo";

// Phase 15 task 4: "robots.txt is not a security control; protection stays
// on the server." This disallow list is advisory for well-behaved
// crawlers only — the real access control is requireUser() on every
// dashboard page (apps/web/src/lib/require-user.ts), checked server-side
// on every request regardless of what any crawler does. The per-page
// `noindex` meta tag (buildPageMetadata's `noindex: true`) is the primary,
// more reliable exclusion mechanism for auth-flow pages; this file only
// adds the one blanket, easy-to-state disallow for the private area.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/settings"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
