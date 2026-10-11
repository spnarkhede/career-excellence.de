import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/seo";

// Phase 15 task 4: sitemap generated from PUBLIC routes only. Hand-maintained
// (small, stable route count) rather than derived from scripts/route-matrix.ts's
// discoverPages() — that script classifies a page as public purely by the
// ABSENCE of a server-side requireUser()/requirePermission() call, which is
// correct for authorization but not the same question as "should this be in
// a search engine's sitemap": every auth flow page (login, signup, OTP,
// magic link, password reset, email verification, OAuth error/pending) is
// also technically reachable unauthenticated, yet none of them belong in a
// sitemap — they're single-purpose flow steps, not content a search engine
// should index or send organic traffic to (see their own `noindex` metadata,
// via buildPageMetadata's `noindex: true`). Only the genuine marketing/
// informational pages are listed here; this list and each page's own
// `noindex` flag are kept in sync by hand, since Next provides no mechanism
// to derive one from the other automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteUrl();
  return [
    { url: baseUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
