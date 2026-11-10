import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/privacy";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { APPLY_PATH, MEMBER_APPLY_PATH, REP_APPLICATIONS_PATH } from "@/lib/applyRoutes";

/**
 * /apply: the one door, with a choice behind it.
 *
 * There are two unrelated applications — membership, which anyone can fill in
 * in a minute, and First Year Rep, which takes about ten — and one address
 * people remember and print. So this page asks which, and nothing else: no
 * scroll journey, no WebGL, two links and a way back to the site. (Until
 * 10 Nov 2026 the second card was the exec application, now closed.)
 *
 * ⛔ It is NOT where a "Join WEC" button should point. Those go straight to
 * MEMBER_APPLY_PATH, because someone tapping Join has already chosen. This
 * page is for the people who arrive without having chosen: a typed address, a
 * printed QR code from before the split, a link passed along by a friend.
 *
 * The First Year Rep page says for itself whether applications are open, so
 * this card always links to it.
 *
 * connection() keeps this route rendered per request, as it was when the exec
 * card read a runtime setting; it is cheap and keeps the page from going stale
 * if a card here reads a setting again.
 */
export const metadata: Metadata = {
  title: "Apply — WEC",
  description:
    "Apply to the Western Entrepreneurship Collective: become a member, or apply to be a First Year Rep.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: APPLY_PATH } } : {}),
  openGraph: {
    title: "Apply — WEC",
    description:
      "Apply to the Western Entrepreneurship Collective: become a member, or apply to be a First Year Rep.",
    type: "website",
    locale: "en_CA",
  },
};

export default async function ApplyPage() {
  await connection();

  return (
    <main className="apply-page">
      <header className="apply-head">
        <Link href="/" className="apply-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">By Founders, for Founders.</span>
      </header>

      <div className="apply-card apply-choose">
        <h1>What are you applying for?</h1>
        <p>Two different things, two different forms. Pick the one you came for.</p>

        <ul className="apply-choices">
          <li>
            <Link href={MEMBER_APPLY_PATH} className="apply-choice">
              <span className="micro" aria-hidden="true">01</span>
              <span className="apply-choice-title">Become a member<Arrow diagonal /></span>
              <span className="apply-choice-note">
                Open to every Western student. Free, and takes about a minute.
              </span>
            </Link>
          </li>
          <li>
            <Link href={REP_APPLICATIONS_PATH} className="apply-choice">
              <span className="micro" aria-hidden="true">02</span>
              <span className="apply-choice-title">Become a First Year Rep<Arrow diagonal /></span>
              <span className="apply-choice-note">
                For first-year Western students. 5 spots. Takes about 10 minutes.
              </span>
            </Link>
          </li>
        </ul>
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
