/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@englishi/shared-types'],
  experimental: { typedRoutes: true },
};
module.exports = nextConfig;

