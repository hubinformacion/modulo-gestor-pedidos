import type { NextConfig } from "next";
import { getEmbedCsp, getWordPressOrigins } from "./src/lib/iframe/config";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: getEmbedCsp(getWordPressOrigins()) }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }, { source: "/seguimiento/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Content-Type-Options", value: "nosniff" }] }];
  },
  outputFileTracingIncludes: { "/*": ["./src/assets/pdfs/*.pdf"] },
};

export default nextConfig;
