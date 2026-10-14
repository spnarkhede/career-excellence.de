/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 16 task 2: no `<Image>`/`<img>` exists anywhere in this app yet
  // (text/form-only SaaS starter) — this is forward-looking config so the
  // FIRST image added automatically gets AVIF/WebP (with the browser's own
  // `Accept` header deciding the fallback) and responsive `deviceSizes`,
  // rather than that being a separate decision made later.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: [
    "@saas/ui",
    "@saas/design-tokens",
    "@saas/api-client",
    "@saas/contracts",
    "@saas/validation",
    "@saas/security",
    "@saas/analytics",
    "@saas/config",
  ],
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
