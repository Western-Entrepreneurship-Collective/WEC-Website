import type { MetadataRoute } from "next";

// The public pages people should find in search. WEC OS, the closed exec
// application and /slack (noindex) are left out on purpose.
const PAGES = ["/", "/apply", "/apply/member", "/apply/first-year-rep", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  // No site address set (a local build): list nothing rather than localhost links.
  if (!site) return [];
  return PAGES.map(path => ({ url: path === "/" ? `${site}/` : `${site}${path}` }));
}
