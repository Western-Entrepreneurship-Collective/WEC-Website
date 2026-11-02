"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/graphics/DraftGraphics";

export type NavItem = { href: string; label: string };

// The address decides which link is lit. A task belongs to My tasks wherever it was opened from.
const isCurrent = (href: string, pathname: string) => href === "/os" ? pathname === "/os" || pathname.startsWith("/os/tasks") : pathname === href || pathname.startsWith(`${href}/`);

export function Shell({ nav, inbox, me, children }: { nav: NavItem[]; inbox: number; me: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="os-shell">
      <a className="os-skip" href="#os-main">Skip to content</a>
      <header className="os-bar">
        <Link href="/os" className="os-bar-logo" aria-label="WEC OS home"><Logo reversed priority className="os-logo" /></Link>
        <nav aria-label="Main" className="os-bar-nav">
          {nav.map(item => <Link key={item.href} href={item.href} aria-current={isCurrent(item.href, pathname) ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="os-bar-tools">
          <Link className="os-bar-icon" href="/os/search" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </Link>
          <Link className="os-bar-icon" href="/os/notifications" aria-label={inbox ? `Inbox, ${inbox} new` : "Inbox"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 20a2 2 0 004 0" /></svg>
            {inbox ? <span className="os-bar-count" aria-hidden="true">{inbox}</span> : null}
          </Link>
          <Link className="os-bar-new" href="/os/tasks/new">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            New task
          </Link>
          {me}
        </div>
      </header>
      <main id="os-main" className="os-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
