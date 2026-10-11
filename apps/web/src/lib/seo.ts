import type { Metadata } from "next";

// The one place a page's canonical/OG/Twitter URL is computed from — reuses
// the exact env var + fallback already established by layout.tsx's
// metadataBase, robots.ts, and sitemap.ts (see .env.example: the production
// value is the real deployed domain, e.g. https://example.com per
// docs/auth/ARCHITECTURE.md §1.6's placeholder).
export const SITE_NAME = "App Platform";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}

/**
 * Builds a complete, self-contained page `Metadata` object — title,
 * description, canonical URL, and matching OpenGraph/Twitter fields — so
 * every public page declares its own full metadata rather than relying on
 * Next's parent/child metadata merge (which replaces, not deep-merges,
 * nested objects like `openGraph` — a page that only overrides `title`
 * would otherwise silently lose the parent's `openGraph.description`).
 * The social preview IMAGE itself is not set here: the root
 * `opengraph-image.tsx`/`twitter-image` file convention auto-fills
 * `openGraph.images`/`twitter.images` for any page that doesn't already
 * define its own, with an absolute URL computed from `metadataBase`.
 */
export function buildPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    // `absolute` bypasses the root layout's title TEMPLATE (`%s | ${SITE_NAME}`)
    // entirely — every page here already composes its own full, final title
    // (checklist task 1's ~50-60 character target is measured on the whole
    // displayed title, not the un-suffixed page name), so applying the
    // template on top would both double-suffix the site name and silently
    // push every title past its intended length.
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: url },
    ...(opts.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
  };
}
