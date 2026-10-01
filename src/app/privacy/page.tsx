import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { PRIVACY_EMAIL, PRIVACY_PATH } from "@/lib/privacy";

/**
 * The privacy policy, word for word as the club approved it on 21 Sept 2026.
 *
 * ⛔ Change the wording only with the club's say-so, and update LAST_UPDATED
 * whenever it changes: the policy itself promises that date moves.
 *
 * ⛔ Keep it true. Every line here is checked against what the site does:
 * the fields listed are the fields both forms send, "no cookies" and "no
 * analytics" hold because the site loads neither, and both forms refuse to
 * send anything until the visitor ticks the box that links here.
 */
const LAST_UPDATED = "21 September 2026";

export const metadata: Metadata = {
  title: "Privacy Policy — WEC",
  description: "What the Western Entrepreneurship Collective collects on this website, why, and what you can do about it.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: PRIVACY_PATH } } : {}),
};

function Email() {
  return <a className="privacy-link" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;
}

export default function PrivacyPage() {
  return (
    <main className="apply-page">
      <header className="apply-head">
        <Link href="/" className="apply-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">By Founders, for Founders.</span>
      </header>

      <article className="apply-card privacy">
        <h1>Privacy Policy</h1>
        <p className="privacy-meta">Western Entrepreneurship Collective (WEC)<br />Last updated: {LAST_UPDATED}</p>

        <h2>Who we are</h2>
        <p>WEC is a student club at Western University. This page explains what information we collect on this website, why, and what you can do about it.</p>
        <p>Questions? Email us at <Email />.</p>

        <h2>What we collect</h2>
        <h3>When you join WEC</h3>
        <ul>
          <li>Your name</li>
          <li>Your email</li>
          <li>Your year of study</li>
          <li>Your answers to our questions (what you are building, and the others on the form)</li>
        </ul>
        <h3>When you apply to be an executive</h3>
        <ul>
          <li>Your name</li>
          <li>Your Western email, and a personal email if you give one</li>
          <li>Your phone number</li>
          <li>Your program and year</li>
          <li>The role you are applying for</li>
          <li>Your introduction and answers</li>
          <li>Links you choose to share: LinkedIn, portfolio, resume</li>
        </ul>
        <h3>When you visit the site</h3>
        <ul>
          <li>We do not use cookies.</li>
          <li>We do not use analytics or tracking.</li>
          <li>Our web host (Vercel) keeps standard server logs, which include your IP address, to keep the site running and secure.</li>
        </ul>

        <h2>Why we collect it</h2>
        <ul>
          <li>To add you as a member and contact you about WEC.</li>
          <li>To review your executive application and contact you about it.</li>
          <li>Nothing else.</li>
        </ul>

        <h2>Who can see it</h2>
        <ul>
          <li>Only the WEC executive team.</li>
          <li>We never sell your information.</li>
          <li>We never share it with sponsors or anyone outside the executive team.</li>
        </ul>

        <h2>Where it is stored</h2>
        <ul>
          <li>Your answers are sent to Google Forms and stored in Google Sheets.</li>
          <li>Google may store this information outside Canada.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li><strong>Executive applications:</strong> deleted when that hiring round is finished.</li>
          <li><strong>Members:</strong> kept for the school year. At the end of each year we email you to renew. If you renew, you stay a member. If you do not, we delete your information.</li>
        </ul>

        <h2>Your choices</h2>
        <p>You can ask us to:</p>
        <ul>
          <li>Show you what we have about you</li>
          <li>Fix anything that is wrong</li>
          <li>Delete your information</li>
        </ul>
        <p>Email <Email />. We will reply within 30 days.</p>

        <h2>Emails from us</h2>
        <p>We only email you about your membership or your application. If we ever start a newsletter, we will ask you first.</p>

        <h2>Changes</h2>
        <p>If we change this policy, we will update the date at the top of this page.</p>
      </article>

      <footer className="apply-foot">
        <Link href="/" className="text-link">
          Explore the rest of the site<Arrow />
        </Link>
      </footer>
    </main>
  );
}
