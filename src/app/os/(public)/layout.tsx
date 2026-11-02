import Link from "next/link";
import { Logo } from "@/components/graphics/DraftGraphics";
import { supabaseEnv } from "@/lib/os/config";

export default function PublicOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="apply-page os-gate">
      <header className="apply-head">
        <Link href="/" className="apply-brand" aria-label="Western Entrepreneurship Collective — home"><Logo reversed priority /></Link>
        <span className="micro">WEC OS</span>
      </header>
      <div className="apply-card">
        {supabaseEnv() ? children : (
          <>
            <h1>WEC OS is not set up yet.</h1>
            <p>This workspace has not been configured on this deployment. The public site is not affected.</p>
          </>
        )}
      </div>
    </main>
  );
}
