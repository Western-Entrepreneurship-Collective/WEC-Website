import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // Browsers and crawlers ask for /favicon.ico whatever the page says; answer with
  // the same icon the page metadata uses instead of a 404.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/brand/icon.png" }];
  },
  // WEC OS is private. The page metadata says the same; this also covers responses
  // that are not HTML. It is deliberately not in a robots file, which would list it.
  async headers() {
    return [
      { source: "/os/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] },
      // Every page. None of these touch scripts, styles, fonts or images, so the
      // 3D scene, the motion and the forms load exactly as before:
      // - frame-ancestors / X-Frame-Options: no other site can put a WEC page in a
      //   frame and trick someone into clicking (clickjacking).
      // - base-uri, object-src, form-action: no injected <base>, plugin or form can
      //   send anything off the site. Every form here posts to this site itself.
      // - nosniff: a file is only ever treated as the type it was served as.
      // - Referrer-Policy: other sites see only joinwec.ca, never a full /os link.
      // - Permissions-Policy: no camera, microphone or location for any page.
      { source: "/:path*", headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ] },
    ];
  },
};

export default nextConfig;
