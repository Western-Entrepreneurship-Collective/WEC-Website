import { Logo } from "./DraftGraphics";
import { RevealHeading } from "@/components/ui/Editorial";

export function StudioDoor() {
  return <div className="studio-door">
    <div className="door-coordinate micro" aria-hidden="true">WEC / A way in</div>
    <div className="door-frame">
      <div className="door-aperture" aria-hidden="true"><div className="door-interior"><span className="door-room-line line-left" /><span className="door-room-line line-right" /><span className="door-room-line line-top" /><span className="door-room-line line-bottom" /><span className="door-welcome">You’re in<br />good company.</span></div></div>
      <div className="door-trim" aria-hidden="true" />
      <div className="door-leaf">
        <div className="door-leaf-back" aria-hidden="true" />
        <div className="door-leaf-face">
          <span className="door-hinge hinge-top" aria-hidden="true" /><span className="door-hinge hinge-bottom" aria-hidden="true" />
          <div className="door-identity hero-copy"><Logo className="hero-mark" reversed priority /><p className="hero-full-name">Western Entrepreneurship Collective</p><RevealHeading as="h1" id="hero-heading" className="hero-positioning" lines={["By Founders,", "for Founders."]} /><span className="door-identity-rule" aria-hidden="true" /></div>
          <div className="door-lower-panel" aria-hidden="true" /><span className="door-handle-plate" aria-hidden="true"><span className="door-handle" /></span><span className="door-kickplate" aria-hidden="true" />
        </div>
      </div>
      <span className="door-sill" aria-hidden="true" />
    </div>
    <div className="door-floor" aria-hidden="true"><i /><i /><i /></div>
  </div>;
}
