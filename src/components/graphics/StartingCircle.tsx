import { CampusCanvas } from './CampusCanvas';

export function StartingCircle({selected,onSelect}:{selected:number;onSelect:(index:number)=>void}) {
  return <div className="starting-room"><CampusCanvas mode="room" selected={selected} onSelect={onSelect} /></div>;
}
