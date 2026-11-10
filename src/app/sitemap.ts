import type { MetadataRoute } from "next";

// The public pages people should find in search. WEC OS and the closed exec
// application are left out on purpose.
const PAGES = ["/", "/apply", "/apply/member", "/apply/first-year-rep", "/privacy", "/slack"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return PAGES.map(path => ({ url: path === "/" ? `${site}/` : `${site}${path}` }));
}
