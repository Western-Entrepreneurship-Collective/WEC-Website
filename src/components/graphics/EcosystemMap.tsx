import { Logo } from "./DraftGraphics";
import { siteContent as c } from "@/data/siteContent";

function ConnectionArrow() {
  return <svg className="ecosystem-arrow" viewBox="0 0 80 24" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M1 12H74M66 4l8 8-8 8" vectorEffect="non-scaling-stroke" /></svg>;
}

export function EcosystemMap() {
  return <div className="ecosystem-map"><div className="ecosystem-camera">
    <p className="ecosystem-world micro">{c.ecosystem.world}</p>
    <div className="ecosystem-wec"><span className="micro">Your starting point</span><Logo /></div>
    <div className="ecosystem-link" aria-hidden="true"><ConnectionArrow /></div>
    <div className="ecosystem-centre"><span className="micro">Strong ties</span><h3>{c.ecosystem.centre}</h3></div>
    <ul className="ecosystem-nodes" aria-label="Paths into the wider ecosystem">{c.ecosystem.nodes.map((node, i) => <li className="ecosystem-route" key={node}><span className="ecosystem-connector" aria-hidden="true"><ConnectionArrow /></span><div className={`ecosystem-node ecosystem-node-${i}`}>{node}</div></li>)}</ul>
  </div></div>;
}
