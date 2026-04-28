import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export for S3 + CloudFront hosting.
  // Run `npm run build` -> produces `out/` directory. Upload that to S3.
  output: "export",

  // Image optimisation needs a Node server; not available with static export.
  images: { unoptimized: true },

  // Trailing slashes match S3's directory-index behaviour
  // (e.g. /catalog/ -> /catalog/index.html). Keeps URLs stable across CloudFront.
  trailingSlash: true,
};

export default nextConfig;
