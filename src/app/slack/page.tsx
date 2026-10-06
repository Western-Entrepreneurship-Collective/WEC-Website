import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { contactEmail, slackUrl } from "@/data/siteContent";
import { PRIVACY_PATH } from "@/lib/privacy";

/**
 * /slack — the one job page: get an existing member into the club's Slack.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE SIGN UP
 *
 * The onboarding steps on the sign up are a state INSIDE the form: they appear
 * once, to the person who has just submitted it. There is no address for them.
 * So a member who joined last week cannot be sent there. Linking them to
 * /apply/member instead would ask them to fill the form a second time and put
 * a duplicate row, and a second signature, in the club's Sheet.
 *
 * This page is the address. It asks nothing, stores nothing and sends nothing:
 * it is a door, and the only thing on it is the handle.
 *
 * ⛔ IT COLLECTS NOTHING, SO IT MUST KEEP COLLECTING NOTHING. The moment this
 * grows a field it needs the privacy consent every other form here carries
 * (src/lib/privacy.ts). A page that gathers nothing needs no consent, and that
 * is the whole reason it can be emailed to a list without ceremony.
 */
export const metadata: Metadata = {
  title: "Join the WEC Slack",
  description: "The WEC Slack is where announcements, events and introductions happen.",
  // Not a page to be found in search: it is handed to people who are already
  // members. It is not secret either, so this is tidiness, not protection.
  robots: { index: false, follow: true },
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: "/slack" } } : {}),
  openGraph: {
    title: "Join the WEC Slack",
    description: "The WEC Slack is where announcements, events and introductions happen.",
    type: "website",
    locale: "en_CA",
  },
};

export default function SlackPage() {
  return (
    <main className="apply-page">
      <header className="apply-head">
        <Link href="/" className="apply-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">By Founders, for Founders.</span>
      </header>

      <div className="apply-card">
        <h1>Join the WEC Slack.</h1>
        <p>
          It is where announcements, events and everything between meetings
          happen. Two minutes, then you are done.
        </p>

        {/*
          Both steps show whether or not the link is set. The instruction to
          introduce yourself is useful either way, and a page that loses half
          its content because of a deploy setting reads as broken. Only the
          BUTTON degrades: unset, step one says where to get the link instead
          of rendering one that goes nowhere.
        */}
        <ol className="join-next-steps slack-steps">
          <li>
            <strong>Join the Slack.</strong> Use your Western email and you are
            straight in.
            {slackUrl ? (
              /*
                ⛔ NOT a bare .join-primary. That class is built for a dark
                section: white fill, white border, purple text. This card is
                white, so on its own it renders a white button with a white
                border that vanishes under the cursor. .join-next-btn is the
                existing fix (apply.css), filled purple with an inverted hover.
              */
              <p>
                <a
                  className="join-primary join-next-btn"
                  href={slackUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join the WEC Slack<Arrow diagonal />
                </a>
              </p>
            ) : (
              <p className="join-dues">
                The invite link is not set up yet.{" "}
                {contactEmail ? (
                  <>Email <a className="text-link" href={`mailto:${contactEmail}`}>{contactEmail}</a> and we will send it to you.</>
                ) : (
                  <>Check back shortly and it will be here.</>
                )}
              </p>
            )}
          </li>
          <li>
            <strong>Say hi in #introductions.</strong> Write your name, your
            year, and a small intro about yourself &mdash; what you are
            building, or what you are curious about. A couple of sentences is
            plenty.
          </li>
        </ol>
        <p className="join-signed">Nothing on this page is recorded.</p>
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
