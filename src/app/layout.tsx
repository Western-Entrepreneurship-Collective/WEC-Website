import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource/caveat/latin-600.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import "@/styles/spatial.css";
import "@/styles/studio.css";
import "@/styles/door.css";
import "@/styles/scenes.css";
import "@/styles/ecosystem.css";
import "@/styles/editorial.css";
import "@/styles/mobile.css";
import "@/styles/apply.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "WEC — By Founders, for Founders.",
  description: "Western Entrepreneurship Collective. A community of student founders, curious minds, and people building what’s next at Western University.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: "/" } } : {}),
  openGraph: {
    title: "WEC — By Founders, for Founders.",
    description: "Every venture starts incomplete. Find your people. Start building.",
    type: "website",
    locale: "en_CA",
    images: [{ url: "/brand/social.png", width: 1774, height: 887, alt: "Western Entrepreneurship Collective" }],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/brand/icon.png", apple: "/brand/icon.png" },
};

export const viewport: Viewport = { themeColor: "#582C83" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-CA"><body>{children}</body></html>;
}
