"use client";

import { useRef, type KeyboardEvent } from "react";
import { Arrow, DraftFrame, Logo } from "@/components/graphics/DraftGraphics";
import { RevealHeading, SectionHeading, TextLink } from "@/components/ui/Editorial";
import { contactEmail, destinations, googleForm, siteContent as c } from "@/data/siteContent";
import { JoinFragments } from "@/components/graphics/StoryLayers";
import { Spark } from "@/components/graphics/StudioGraphics";
import Link from "next/link";
import { APPLY_PATH, EXEC_APPLICATIONS_PATH } from "@/lib/applyRoutes";

function DestinationAction({ kind }: { kind: "join" | "events" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const destination = destinations[kind];
  const label = kind === "join" ? c.join.primary : c.join.secondary;
  const className = kind === "join" ? "join-primary" : "join-secondary";
  const content = c.join.unavailable[kind];

  if (destination) return <a className={className} href={destination}>{label}<Arrow diagonal /></a>;

  // ⭐ EVERY JOIN WEC CALL TO ACTION GOES TO THE SAME PLACE: the chooser at
  // /apply, which asks whether this is a membership or an exec application.
  // This button used to open the sign up in a dialog. It no longer does, so
  // that the header, the mobile menu, the Collective link and this button all
  // behave identically — one door, whichever one a reader presses.
  // ⛔ The instant NEXT_PUBLIC_WEC_JOIN_URL is set this branch stops running
  // and the real link wins, with nothing to undo.
  // ⛔ AND ONLY IF THERE IS SOMEWHERE FOR THE ANSWERS TO GO. Without a Google
  // Form or an address the club actually owns, it falls through to the honest
  // dialog below rather than walking someone to a form that cannot deliver:
  // the address both sites were carrying belongs to a domain squatter. See the
  // note on contactEmail in siteContent. The events dialog is untouched,
  // because there is nothing to collect for an event that is not scheduled.
  if (kind === "join" && (googleForm.ok || contactEmail)) {
    return <Link className={className} href={APPLY_PATH}>{label}<Arrow diagonal /></Link>;
  }

  function close() { dialogRef.current?.close(); buttonRef.current?.focus(); }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href]")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <><button className={className} ref={buttonRef} onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog">{label}<Arrow diagonal /></button><dialog ref={dialogRef} className="join-dialog" aria-labelledby={`${kind}-dialog-title`} aria-describedby={`${kind}-dialog-description`} onKeyDown={trapFocus} onClick={event => { if (event.target === event.currentTarget) close(); }} onClose={() => buttonRef.current?.focus()}><div className="dialog-inner"><button className="dialog-close" onClick={close} aria-label="Close dialog" autoFocus><span aria-hidden="true">×</span></button><Logo /><p className="micro">Western Entrepreneurship Collective</p><h2 id={`${kind}-dialog-title`}>{content.title}</h2><p id={`${kind}-dialog-description`}>{content.description}</p><a href="#experience" className="text-link" onClick={close}>Explore the experience <Arrow /></a></div></dialog></>;
}

export function Join() {
  return <section className="join brand-section section-pad" id="join" aria-labelledby="join-heading"><SectionHeading id="join-heading">{c.join.label}</SectionHeading><div className="join-composition"><DraftFrame className="join-frame" /><JoinFragments /><div className="join-sticker"><Spark /><span>Come as<br />you are.</span></div><RevealHeading as="p" lines={c.join.headline} /><div className="join-lower"><p className="section-lead">{c.join.description}</p><div className="join-actions"><DestinationAction kind="join" /><DestinationAction kind="events" /></div></div><p className="join-exec"><Link className="text-link" href={EXEC_APPLICATIONS_PATH}>Exec team applications<Arrow /></Link></p><div className="join-signoff"><span className="micro">{c.join.annotation}</span><Logo reversed /></div></div></section>;
}

export function Footer({ motionEnabled, toggleMotion }: { motionEnabled: boolean; toggleMotion: () => void }) {
  return <footer className="site-footer"><div className="footer-main"><Logo lockup /><TextLink href="#hero">{c.footer.top}</TextLink></div><div className="footer-meta"><span>© {new Date().getFullYear()} WEC</span><span>{c.footer.location}</span><button className="motion-toggle" onClick={toggleMotion} aria-pressed={motionEnabled} aria-label={`Motion ${motionEnabled ? "on — turn off animations" : "off — turn on the full experience"}`}><span className={`motion-dot ${motionEnabled ? "is-on" : ""}`} />Motion {motionEnabled ? "on" : "off"}</button><span className="footer-positioning">{c.footer.note}</span></div></footer>;
}
