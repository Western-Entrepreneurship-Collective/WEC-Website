import { siteContent as c } from '@/data/siteContent';
import { ClassroomCaption } from './ClassroomCaption';
import { CampusCanvas } from './CampusCanvas';

export function EcosystemJourney() {
  return <div className="ecosystem-scene" data-progress="0">
    <div className="ecosystem-scene-stage">
      <div className="journey-viewport">
        <CampusCanvas mode="journey" />
        <ClassroomCaption preview />
        <div className="journey-welcome"><span className="micro">Your first step</span><p>It starts with WEC.</p><span>Follow the path to Morrissette <span aria-hidden="true">↗</span></span></div>
        <div className="arrival-directory">
          <p className="arrival-caption micro">One entrance. Six possibilities.</p>
          <ul className="opportunity-signs" aria-label="Opportunities in the Morrissette ecosystem">{c.ecosystem.nodes.map((node,i)=><li className={`opportunity-sign opportunity-sign-${i}`} key={node}><span className="sign-index micro">0{i+1}</span><span className="opportunity-name">{node}</span><span className="sign-arrow" aria-hidden="true">↗</span></li>)}</ul>
        </div>
        <div className="journey-instruction micro"><span>WEC → Morrissette</span><span>Scroll to explore ↓</span></div>
      </div>
    </div>
  </div>;
}
