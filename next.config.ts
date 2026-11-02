import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // WEC OS is private. The page metadata says the same; this also covers responses
  // that are not HTML. It is deliberately not in a robots file, which would list it.
  async headers() {
    return [{ source: "/os/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] }];
  },
};

export default nextConfig;
