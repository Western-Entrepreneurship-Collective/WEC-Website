import { Arrow } from "./DraftGraphics";
import { siteContent as c } from "@/data/siteContent";
import { TextLink } from "@/components/ui/Editorial";

export function StudioDoor() {
  return <div className="studio-door" aria-hidden="true">
    <div className="door-coordinate micro">WEC / A way in</div>
    <div className="door-frame">
      <div className="door-aperture"><div className="door-interior"><span className="door-room-line line-left" /><span className="door-room-line line-right" /><span className="door-room-line line-top" /><span className="door-room-line line-bottom" /><span className="door-welcome">You’re in<br />good company.</span></div></div>
      <div className="door-leaf">
        <div className="door-leaf-face"><span className="door-hinge hinge-top" /><span className="door-hinge hinge-bottom" /><div className="door-window"><span className="micro">Western Entrepreneurship<br />Collective</span><span className="door-window-word">Come<br />on in.<Arrow diagonal /></span><span className="door-window-rule" /></div><div className="door-lower-panel" /><span className="door-handle-plate"><span className="door-handle" /></span><span className="door-kickplate" /></div>
      </div>
      <span className="door-sill" />
    </div>
    <div className="door-floor"><i /><i /><i /></div>
  </div>;
}

export function DoorNotes() {
  return <aside className="door-notes" aria-label="Your invitation to WEC">
    <div className="door-note door-note-first"><span className="note-tape micro">{c.hero.notice.label}</span><p className="door-note-title">{c.hero.notice.title}</p><p className="door-note-copy">{c.hero.notice.body}</p><svg className="note-mark" viewBox="0 0 140 28" fill="none" aria-hidden="true"><path d="M3 17c35-12 90-6 132-8M12 25c35-8 76-6 108-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>
    <div className="door-note hero-invitation"><span className="micro">{c.hero.invitationLabel}</span><p className="door-note-title">{c.hero.note}</p><p className="door-note-copy">{c.hero.invitation}</p><TextLink href="#about">{c.hero.cta}</TextLink></div>
  </aside>;
}
