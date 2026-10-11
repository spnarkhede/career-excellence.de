/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 16 task 2: forward-looking — see apps/web/next.config.mjs's comment.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: [
    "@saas/ui",
    "@saas/design-tokens",
    "@saas/api-client",
    "@saas/authorization",
    "@saas/config",
  ],
};

export default nextConfig;
