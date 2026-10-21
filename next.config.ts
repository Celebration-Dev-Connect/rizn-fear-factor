import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // No remote image hosts: every image is served by our own API.
  images: { remotePatterns: [], unoptimized: true },
};

export default nextConfig;
