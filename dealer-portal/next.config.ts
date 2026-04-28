import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export for S3 + CloudFront hosting.
  // Run `npm run build` -> produces `out/` directory. Upload that to S3.
  output: "export",

  images: { unoptimized: true },

  // Trailing slashes match S3's directory-index behaviour.
  trailingSlash: true,
};

export default nextConfig;
