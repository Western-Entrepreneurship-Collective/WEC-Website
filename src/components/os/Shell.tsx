"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/graphics/DraftGraphics";

export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

const matches = (item: NavItem, pathname: string) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

export function Shell({ nav, footer, children }: { nav: NavGroup[]; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the drawer follows navigation
  useEffect(() => setOpen(false), [pathname]);

  // The longest match wins, so a Global Project's list lights up Global Projects and not Projects.
  const current = nav.flatMap(g => g.items).filter(i => matches(i, pathname)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
          <input id="os-search-input" name="q" type="search" placeholder="Search everything" />
        </form>
        <div className="os-nav-groups">
          {nav.map(group => (
            <nav key={group.label} aria-label={group.label}>
              <p className="os-nav-label">{group.label}</p>
              <ul>
                {group.items.map(item => (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={item.href === current ? "page" : undefined}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
                      <span className="os-nav-text">{item.label}</span>
                      {item.badge ? <span className="os-badge">{item.badge}<span className="sr-only"> waiting</span></span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="os-sidebar-foot">{footer}</div>
      </aside>
      <main id="os-main" className="os-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
