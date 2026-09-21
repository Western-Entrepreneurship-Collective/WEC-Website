import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/privacy";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { APPLY_PATH, EXEC_APPLICATIONS_PATH, MEMBER_APPLY_PATH } from "@/lib/execApplications";
import { connectedForm } from "@/lib/execApplicationsServer";

/**
 * /apply: the one door, with a choice behind it.
 *
 * There are two unrelated applications — membership, which anyone can fill in
 * in a minute, and the executive team, which takes half an hour — and one
 * address people remember and print. So this page asks which, and nothing
 * else: no scroll journey, no WebGL, two links and a way back to the site.
 *
 * ⛔ It is NOT where a "Join WEC" button should point. Those go straight to
 * MEMBER_APPLY_PATH, because someone tapping Join has already chosen. This
 * page is for the people who arrive without having chosen: a typed address, a
 * printed QR code from before the split, a link passed along by a friend.
 *
 * The exec card reads the same setting the exec page and its route read, so a
 * closed application says so here instead of sending someone to a page that
 * turns them away. connectedForm() only reads the setting and never calls
 * Google, so this costs a render, not a fetch.
 *
 * ⛔ THE connection() IS LOAD-BEARING. Without it this route is prerendered and
 * process.env is read once, at build time, when WEC_APPLY_GOOGLE_FORM_URL is
 * not set — so the page would be frozen saying applications are closed no
 * matter what Vercel is later told. connection() opts the route into
 * per-request rendering, which is what makes the setting a runtime setting.
 */
export const metadata: Metadata = {
  title: "Apply — WEC",
  description:
    "Apply to the Western Entrepreneurship Collective: become a member, or apply for the executive team.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: APPLY_PATH } } : {}),
  openGraph: {
    title: "Apply — WEC",
    description:
      "Apply to the Western Entrepreneurship Collective: become a member, or apply for the executive team.",
    type: "website",
    locale: "en_CA",
  },
};

export default async function ApplyPage() {
  await connection();
  const execOpen = connectedForm().form !== null;

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
            {execOpen ? (
              <Link href={EXEC_APPLICATIONS_PATH} className="apply-choice">
                <span className="micro" aria-hidden="true">02</span>
                <span className="apply-choice-title">Apply for the exec team<Arrow diagonal /></span>
                <span className="apply-choice-note">
                  Executive, director and coordinator roles for 2026-27. Set aside half an hour.
                </span>
              </Link>
            ) : (
              <div className="apply-choice is-closed">
                <span className="micro" aria-hidden="true">02</span>
                <span className="apply-choice-title">Apply for the exec team</span>
                <span className="apply-choice-note">
                  Executive, director and coordinator applications for 2026-27 are not open yet.
                  Become a member and we will let you know when they are.
                </span>
              </div>
            )}
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
