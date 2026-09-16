"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { siteContent } from "@/data/siteContent";

export function Navigation() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => headerRef.current?.classList.toggle("has-scrolled", !entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
      if (event.key === "Tab") {
        const links = [...(menuRef.current?.querySelectorAll<HTMLElement>("a") ?? [])];
        const first = buttonRef.current;
        const last = links.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    const query = window.matchMedia("(min-width: 760px)");
    const closeOnDesktop = () => { if (query.matches) setOpen(false); };
    query.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      query.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return <header className={`site-header ${open ? "menu-is-open" : ""}`} ref={headerRef}>
    <a className="nav-brand" href="#hero" aria-label="WEC — Western Entrepreneurship Collective — back to the beginning" onClick={() => setOpen(false)}><Logo priority /><span className="nav-descriptor">Western Entrepreneurship <br />Collective</span></a>
    <nav className="desktop-nav" aria-label="Main navigation">{siteContent.navigation.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <a className="nav-join" href="/apply">Join WEC <Arrow diagonal /></a>
    <button ref={buttonRef} className="menu-toggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}><span /><span /></button>
    <div className="mobile-menu" id="mobile-navigation" hidden={!open} ref={menuRef}>
      <nav aria-label="Mobile navigation">{[...siteContent.navigation, { label: "Join WEC", href: "/apply" }].map((item, i) => <a href={item.href} key={item.href} onClick={() => setOpen(false)}><span className="micro">0{i + 1}</span>{item.label}<Arrow /></a>)}</nav>
      <p className="micro">By Founders, for Founders.</p>
    </div>
  </header>;
}
