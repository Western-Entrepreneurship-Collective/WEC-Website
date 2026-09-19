import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/graphics/DraftGraphics";
import { ExecApplicationsForm } from "@/components/sections/ExecApplicationsForm";
import { EXEC_APPLICATIONS_PATH } from "@/lib/execApplications";
import "@/styles/exec-applications.css";

/**
 * WEC Executive Applications 2026-27.
 *
 * ⛔ THE PATH IS A PLACEHOLDER the club chooses. This folder's name IS the URL
 * and must match EXEC_APPLICATIONS_PATH in src/lib/execApplications.ts. It is
 * NOT /apply: that page belongs to the member sign up. See "Choosing the final
 * URL" in docs/EXEC-APPLICATIONS-FORM.md.
 *
 * It opens straight on the form. There is no landing page and no hero on
 * purpose: the club designs its own. Above the questions there is only the WEC
 * mark (the way back to the site) and one line saying what this is.
 *
 * The form itself stays closed ("applications are not open yet") until
 * /api/exec-applications says the club's Google Form is connected AND ready.
 */
export const metadata: Metadata = {
  title: "Executive applications 2026-27 — WEC",
  description: "Applications for the WEC executive team, 2026-27. By founders, for founders.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: EXEC_APPLICATIONS_PATH } } : {}),
  openGraph: {
    title: "Executive applications 2026-27 — WEC",
    description: "Applications for the WEC executive team, 2026-27. By founders, for founders.",
    type: "website",
    locale: "en_CA",
  },
};

export default function ExecApplicationsPage() {
  return (
    <main className="exec-page">
      <header className="exec-head">
        <Link href="/" className="exec-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">WEC Executive Applications 2026-27</span>
      </header>
      <ExecApplicationsForm />
    </main>
  );
}
