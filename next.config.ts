import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/extract": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@sparticuz/chromium/build/**",
    ],
  },
};

export default nextConfig;
