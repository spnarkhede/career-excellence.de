/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@saas/ui", "@saas/design-tokens", "@saas/api-client", "@saas/authorization", "@saas/config"],
};

export default nextConfig;
