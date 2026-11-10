import type { MetadataRoute } from "next";

// The public site only. WEC OS is deliberately NOT named here: a robots file is
// public, so listing /os would advertise it. It is kept out of search by its own
// noindex header instead (next.config.ts).
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(site ? { sitemap: `${site.replace(/\/$/, "")}/sitemap.xml` } : {}),
  };
}
