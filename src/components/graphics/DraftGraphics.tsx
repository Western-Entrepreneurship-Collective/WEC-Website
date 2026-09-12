import Image from "next/image";

export function Logo({ reversed = false, lockup = false, className = "", priority = false }: { reversed?: boolean; lockup?: boolean; className?: string; priority?: boolean }) {
  const name = `wec${lockup ? "-lockup" : ""}${reversed ? "-reversed" : ""}`;
  const width = lockup ? (reversed ? 1509 : 1508) : (reversed ? 770 : 920);
  const height = lockup ? 297 : (reversed ? 260 : 309);
  return <Image src={`/brand/${name}.png`} width={width} height={height} alt="Western Entrepreneurship Collective" className={`wec-logo ${className}`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} unoptimized draggable={false} />;
}

export function Arrow({ diagonal = false, down = false, className = "" }: { diagonal?: boolean; down?: boolean; className?: string }) {
  return <svg className={`arrow ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: diagonal ? "rotate(-45deg)" : down ? "rotate(90deg)" : undefined }}><path d="M4 12h15M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export function RegistrationMark({ className = "" }: { className?: string }) {
  return <span className={`registration ${className}`} aria-hidden="true" />;
}

export function DraftFrame({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`draft-frame ${className}`} aria-hidden="true"><i className="frame-edge top" /><i className="frame-edge right" /><i className="frame-edge bottom" /><i className="frame-edge left" />{["tl", "tr", "bl", "br"].map(corner => <RegistrationMark className={corner} key={corner} />)}{children}</div>;
}

export function VentureLine({ variant = "flow", className = "" }: { variant?: "flow" | "branch" | "resolve"; className?: string }) {
  const paths = { flow: "M0 0V75H80V145H35V220", branch: "M50 0V55M50 55H5V105M50 55H95V105M50 55V150M5 105V150H95V105M50 150V220", resolve: "M0 0V65H80V160H25V220" };
  return <svg className={`venture-line ${className}`} viewBox="0 0 100 220" fill="none" aria-hidden="true"><path d={paths[variant]} pathLength="1" /><circle cx={variant === "branch" ? 50 : variant === "resolve" ? 25 : 35} cy="216" r="3" /></svg>;
}

export function MeasureTicks({ className = "" }: { className?: string }) {
  return <div className={`measure-ticks ${className}`} aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} />)}</div>;
}
