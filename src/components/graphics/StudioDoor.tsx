import Image from "next/image";
import { Logo } from "./DraftGraphics";
import { RevealHeading } from "@/components/ui/Editorial";

const collagePhotos = [
  { name: "conversations", position: "50% 42%" },
  { name: "connections", position: "62% 42%" },
  { name: "presentation", position: "44% 45%" },
  { name: "applause", position: "65% 45%" },
  { name: "ventures", position: "54% 50%" },
  { name: "founders", position: "60% 42%" },
];

export function StudioDoor() {
  return <div className="studio-door">
    <div className="door-coordinate micro" aria-hidden="true">WEC / A way in</div>
    <div className="door-frame">
      <div className="door-aperture" aria-hidden="true">
        <div className="door-interior">
          <div className="door-collage">
            {collagePhotos.map(photo => <div className={`door-collage-photo door-collage-${photo.name}`} key={photo.name}>
              <Image src={`/images/door-collage/${photo.name}.jpg`} alt="" fill sizes="(max-width: 759px) 100vw, 80vw" loading="eager" draggable={false} style={{ objectPosition: photo.position }} />
            </div>)}
            <span className="door-welcome"><span>You’re in<br />good company.</span></span>
          </div>
        </div>
      </div>
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
