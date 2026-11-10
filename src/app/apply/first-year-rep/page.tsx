import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/privacy";
import { Logo } from "@/components/graphics/DraftGraphics";
import { RepApplicationForm } from "@/components/sections/RepApplicationForm";
import { REP_APPLICATIONS_PATH } from "@/lib/applyRoutes";
import "@/styles/exec-applications.css";

/**
 * WEC First Year Rep applications 2026-27, one of the doors off the /apply
 * chooser. It replaces the exec application, which closed on 18 Oct 2026.
 *
 * ⛔ This folder's name IS the URL and must match REP_APPLICATIONS_PATH in
 * src/lib/applyRoutes.ts.
 *
 * It reuses the exec application's stylesheet on purpose: one look for every
 * WEC application form.
 */
export const metadata: Metadata = {
  title: "First Year Rep applications 2026-27 — WEC",
  description: "Apply to be a WEC First Year Rep, 2026-27. For first-year Western students.",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { alternates: { canonical: REP_APPLICATIONS_PATH } } : {}),
  openGraph: {
    title: "First Year Rep applications 2026-27 — WEC",
    description: "Apply to be a WEC First Year Rep, 2026-27. For first-year Western students.",
    type: "website",
    locale: "en_CA",
  },
};

export default function RepApplicationsPage() {
  return (
    <main className="exec-page">
      <header className="exec-head">
        <Link href="/" className="exec-brand" aria-label="Western Entrepreneurship Collective — home">
          <Logo reversed priority />
        </Link>
        <span className="micro">WEC First Year Rep Applications 2026-27</span>
      </header>
      <RepApplicationForm />
      <footer className="exec-foot">
        <Link href={PRIVACY_PATH} className="apply-privacy">Privacy policy</Link>
      </footer>
    </main>
  );
}
