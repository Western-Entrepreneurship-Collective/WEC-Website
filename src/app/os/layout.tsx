import type { Metadata } from "next";
import "@/styles/os.css";

// Everything here depends on who is asking, and the public site must build with no
// Supabase settings at all, so none of it is ever prerendered.
export const dynamic = "force-dynamic";

// Overrides what the root layout sets for the public site. Metadata merges per
// field, so canonical and Open Graph would otherwise be inherited as the homepage.
export const metadata: Metadata = {
  title: { default: "WEC OS", template: "%s · WEC OS" },
  description: "Private workspace for the WEC executive team.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
