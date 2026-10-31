"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/graphics/DraftGraphics";

export type NavItem = { href: string; label: string; badge?: number; exact?: boolean };

export function Shell({ nav, footer, children }: { nav: NavItem[]; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the drawer follows navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="os-shell">
      <a className="os-skip" href="#os-main">Skip to content</a>
      <div className="os-topbar">
        <Link href="/os" aria-label="WEC OS home"><Logo reversed priority className="os-logo" /></Link>
        <button type="button" className="os-menu-btn" aria-expanded={open} aria-controls="os-sidebar" onClick={() => setOpen(v => !v)}>{open ? "Close" : "Menu"}</button>
      </div>
      <aside id="os-sidebar" className={`os-sidebar${open ? " is-open" : ""}`}>
        <Link className="os-brand" href="/os" aria-label="WEC OS home">
          <Logo reversed priority className="os-logo" />
          <span>OS</span>
        </Link>
        <form className="os-search" action="/os/search" role="search">
          <label className="sr-only" htmlFor="os-search-input">Search</label>
          <input id="os-search-input" name="q" type="search" placeholder="Search" />
        </form>
        <nav aria-label="WEC OS">
          <ul>
            {nav.map(item => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    {item.label}
                    {item.badge ? <span className="os-badge">{item.badge}<span className="sr-only"> unread</span></span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="os-sidebar-foot">{footer}</div>
      </aside>
      <main id="os-main" className="os-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
