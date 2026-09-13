"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "./DraftGraphics";
import { siteContent as c } from "@/data/siteContent";

const connections: { from: string; to: string; vertical: boolean; accent?: boolean }[] = [
  { from: "wec", to: "centre", vertical: true },
  ...Array.from({ length: 6 }, (_, i) => ({ from: "centre", to: `node-${i}`, vertical: false })),
  { from: "node-0", to: "node-2", vertical: true, accent: true },
  { from: "node-2", to: "node-4", vertical: true, accent: true },
  { from: "node-1", to: "node-3", vertical: true, accent: true },
  { from: "node-3", to: "node-5", vertical: true, accent: true },
];

export function EcosystemMap() {
  const cameraRef = useRef<HTMLDivElement>(null);
  const markerId = useId().replaceAll(":", "");
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    const camera = cameraRef.current!;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nodes = new Map([...camera.querySelectorAll<HTMLElement>("[data-map-node]")].map(node => [node.dataset.mapNode!, node]));
        const compact = getComputedStyle(camera).getPropertyValue("--map-compact").trim() === "1";
        setPaths(connections.map(({ from, to, vertical }) => {
          const a = nodes.get(from)!;
          const b = nodes.get(to)!;
          // CSS places each card by its centre. Layout measurements remain
          // independent of the camera's scroll-driven scale and translation.
          if (vertical) {
            const start = { x: a.offsetLeft, y: a.offsetTop + a.offsetHeight / 2 + 8 };
            const end = { x: b.offsetLeft, y: b.offsetTop - b.offsetHeight / 2 - 8 };
            return `M${start.x},${start.y} L${end.x},${end.y}`;
          }
          const direction = b.offsetLeft < a.offsetLeft ? -1 : 1;
          const start = { x: a.offsetLeft + direction * (a.offsetWidth / 2 + 8), y: a.offsetTop };
          if (compact) {
            // Outer rails keep every mobile connection clear of the two card columns.
            const rail = direction < 0 ? 0 : camera.clientWidth;
            const end = { x: b.offsetLeft + direction * (b.offsetWidth / 2 + 8), y: b.offsetTop };
            const radius = Math.min(12, Math.abs(start.x - rail) / 2, Math.abs(end.x - rail) / 2);
            return `M${start.x},${start.y} H${rail - direction * radius} Q${rail},${start.y} ${rail},${start.y + radius} V${end.y - radius} Q${rail},${end.y} ${rail - direction * radius},${end.y} H${end.x}`;
          }
          const end = { x: b.offsetLeft - direction * (b.offsetWidth / 2 + 8), y: b.offsetTop };
          const middle = (start.x + end.x) / 2;
          return `M${start.x},${start.y} C${middle},${start.y} ${middle},${end.y} ${end.x},${end.y}`;
        }));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(camera);
    camera.querySelectorAll<HTMLElement>("[data-map-node]").forEach(node => observer.observe(node));
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  return <div className="ecosystem-map">
    <div className="ecosystem-map-heading"><p className="ecosystem-world micro">{c.ecosystem.world}</p><span className="ecosystem-legend micro"><i /> Many ways in. More ways forward.</span></div>
    <div className="ecosystem-camera" ref={cameraRef}>
      <svg className="ecosystem-web" aria-hidden="true"><defs><marker id={`${markerId}-purple`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m2 1 6 4-6 4" /></marker><marker id={`${markerId}-green`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m2 1 6 4-6 4" /></marker></defs>{paths.map((d, i) => <path key={i} className={`ecosystem-arrow${connections[i].accent ? " is-accent" : ""}`} d={d} data-from={connections[i].from} data-to={connections[i].to} markerEnd={`url(#${markerId}-${connections[i].accent ? "green" : "purple"})`} />)}</svg>
      <div className="ecosystem-wec" data-map-node="wec"><span className="micro">Your way in</span><Logo /></div>
      <div className="ecosystem-centre" data-map-node="centre"><span className="micro">Strong ties. Shared possibilities.</span><h3>{c.ecosystem.centre}</h3></div>
      <ul className="ecosystem-nodes" aria-label="People and opportunities in the wider ecosystem">{c.ecosystem.nodes.map((node, i) => <li className={`ecosystem-node ecosystem-node-${i}`} data-map-node={`node-${i}`} key={node}><span className="ecosystem-node-dot" aria-hidden="true" />{node}</li>)}</ul>
    </div>
  </div>;
}
