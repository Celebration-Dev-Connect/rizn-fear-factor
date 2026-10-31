import path from "node:path";
import type { NextConfig } from "next";

// Off-season static site (spec 004): exported to plain files in site/out for S3 + CloudFront.
// It shares content, components, and styles with the dormant contest app in ../src.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
