import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/privacy";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { JoinFormBody } from "@/components/sections/JoinForm";
import { MEMBER_APPLY_PATH } from "@/lib/execApplications";

/**
 * Membership sign up: where every "Join WEC" call to action lands.
 *
 * It is deliberately NOT the home page and NOT an anchor into it. Someone
 * scanning a card at a booth has one intention, on a phone, possibly on bad
 * campus wifi. So this route renders the questions immediately: no scroll
 * journey, no WebGL, no dialog to open first, and no chooser in the way. The
 * home page keeps its animated Join WEC button; both post to the same
 * /api/join.
 *
 * /apply above it is the chooser for people who arrive without knowing which
 * application they want (a printed QR code from before this split lands there,
 * one tap away from this page).
 */
export const metadata: Metadata = {
  title: "Apply to be a member — WEC",
  description:
    "Join the Western Entrepreneurship Collective. Free to join, takes about a minute.",
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { alternates: { canonical: MEMBER_APPLY_PATH } }
    : {}),
  openGraph: {
    title: "Apply to be a member — WEC",
    description: "Join the Western Entrepreneurship Collective. Free to join, takes about a minute.",
    type: "website",
    locale: "en_CA",
  },
};

export default function ApplyMemberPage() {
  return (
    <main className="apply-page">
      <header className="apply-head">
        <Link href="/" className="apply-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">By Founders, for Founders.</span>
      </header>

      <div className="apply-card">
        <JoinFormBody headingTag="h1" />
      </div>

      <footer className="apply-foot">
        <Link href="/" className="text-link">
          Explore the rest of the site<Arrow />
        </Link>
        <Link href={PRIVACY_PATH} className="apply-privacy">Privacy policy</Link>
      </footer>
    </main>
  );
}
