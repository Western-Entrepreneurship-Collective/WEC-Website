import { MeasureTicks } from "./DraftGraphics";

export function ProofGuides() {
  return <div className="proof-guides motion-art" aria-hidden="true">
    <div className="proof-guide-horizontal"><MeasureTicks /></div>
    <div className="proof-guide-vertical"><MeasureTicks /></div>
    <div className="proof-guide-corner" />
  </div>;
}

export function FieldDepth({ people }: { people: readonly string[] }) {
  return <div className="field-depth motion-art" aria-hidden="true">
    <div className="field-echo">{people.map(person => <span className="field-echo-word" key={person}>{person}</span>)}</div>
    <div className="field-focus-line"><i /><i /></div>
  </div>;
}

export function JoinFragments() {
  return <div className="join-fragments motion-art" aria-hidden="true">{["tl", "tr", "bl", "br"].map(corner => <i className={`join-fragment ${corner}`} key={corner}><span /></i>)}</div>;
}
