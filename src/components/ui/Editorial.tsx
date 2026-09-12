import { Arrow } from "@/components/graphics/DraftGraphics";

export function SectionHeading({ children, id, program = false }: { children: React.ReactNode; id: string; program?: boolean }) {
  return <h2 id={id} className={`section-heading${program ? " section-heading--program" : ""}`}>{children}</h2>;
}

export function RevealHeading({ lines, as: Tag = "h2", className = "", id }: { lines: string[]; as?: "h1" | "h2" | "h3" | "p"; className?: string; id?: string }) {
  return <Tag className={`reveal-heading ${className}`} id={id}>{lines.map((line, i) => <span className="line-mask" key={line}><span className="reveal-line">{line}</span>{i < lines.length - 1 && <span className="sr-only"> </span>}</span>)}</Tag>;
}

export function TextLink({ children, href, className = "", diagonal = false }: { children: React.ReactNode; href: string; className?: string; diagonal?: boolean }) {
  return <a className={`text-link ${className}`} href={href}><span>{children}</span><Arrow diagonal={diagonal} /></a>;
}
