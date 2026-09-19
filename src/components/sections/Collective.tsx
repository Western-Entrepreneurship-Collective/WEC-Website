"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Arrow } from "@/components/graphics/DraftGraphics";
import { MEMBER_APPLY_PATH } from "@/lib/applyRoutes";
import { ClassroomCaption } from "@/components/graphics/ClassroomCaption";
import { StartingCircle } from "@/components/graphics/StartingCircle";
import { EcosystemJourney } from "@/components/graphics/EcosystemJourney";
import { RevealHeading, SectionHeading, TextLink } from "@/components/ui/Editorial";
import { siteContent as c } from "@/data/siteContent";

export function Community() {
  const [selected, setSelected] = useState(0);
  return <section className="community section-pad" id="community" aria-labelledby="community-heading">
    <SectionHeading id="community-heading">{c.community.label}</SectionHeading><div className="community-intro"><RevealHeading as="p" lines={c.community.headline} /><p className="section-lead">{c.community.description}</p></div>
    <div className="community-wall">
      <div className="community-photo-wall"><figure className="community-poster"><Image src="/images/community-conversation.png" alt="Three people sharing a conversation at an entrepreneurship gathering." fill sizes="(max-width: 759px) 85vw, 40vw" /><figcaption>Find your<br /><em>people.</em></figcaption></figure><figure className="community-photo-detail"><Image src="/images/community-speaker.jpg" alt="A presenter speaking into a microphone beside purple, green, and gold balloons." fill sizes="(max-width: 759px) 40vw, 20vw" /><figcaption className="micro">Start with hello.</figcaption></figure></div>
      <div className="community-formats"><span className="micro">Different ways to get together</span><div className="community-choices" role="group" aria-label="Community gatherings">{c.community.events.map((event, i) => <div className="community-choice" key={event}><button onClick={() => setSelected(selected === i ? -1 : i)} aria-expanded={selected === i} aria-controls={`community-answer-${i}`}><span className="micro" aria-hidden="true">0{i + 1}</span><span>{event}</span><Arrow diagonal /></button><div className="community-answer" id={`community-answer-${i}`} hidden={selected !== i}><span className="community-answer-mark" aria-hidden="true">↳</span><p>{c.community.eventNotes[i]}</p></div></div>)}</div><TextLink href={MEMBER_APPLY_PATH}>Come find your people</TextLink></div>
    </div>
  </section>;
}

export function Pillars() {
  const sectionRef = useRef<HTMLElement>(null);
  function showPillar(index: number) {
    if (sectionRef.current?.dataset.sequence === "true") sectionRef.current.dispatchEvent(new CustomEvent("wec:pillar", { detail: index }));
    else document.getElementById(`pillar-${index}`)?.scrollIntoView({ behavior: "instant", block: "center" });
  }
  return <section className="pillars section-pad" id="pillars" aria-labelledby="pillars-heading" ref={sectionRef}>
    <div className="foundation-scene">
      <h2 className="section-heading scene-title" id="pillars-heading">{c.pillars.label}</h2>
      <div className="foundation-scene-heading"><p>{c.pillars.introduction}</p></div>
      <div className="foundation-structure">
        <div className="building-roof" aria-hidden="true"><svg viewBox="0 0 1200 130" preserveAspectRatio="none" fill="none"><path d="M10 102 600 8l590 94v18H10Z" fill="white" stroke="#dedce2" strokeWidth="2" /><path d="m76 93 524-72 524 72H76Z" fill="white" stroke="#dedce2" /><path d="M0 120h1200v10H0Z" fill="white" /><path d="M20 105h1160M600 8v13" stroke="#dedce2" /></svg></div>
        <div className="building-columns" aria-hidden="true">{c.pillars.items.map((pillar, i) => <div className="building-bay" key={pillar.name}><div className="building-column"><span className="column-capital" /><span className="column-shaft"><span className="column-ordinal">0{i + 1}</span><i /><i /><i /></span><span className="column-plinth" /></div></div>)}</div>
      <div className="pillar-panels">{c.pillars.items.map((pillar, i) => <article className="pillar-panel" id={`pillar-${i}`} key={pillar.name} aria-labelledby={`pillar-title-${i}`}>
        <span className="foundation-number" aria-hidden="true">0{i + 1}</span><h3 className="pillar-word" id={`pillar-title-${i}`}>{pillar.name}</h3>
        <div className="pillar-meaning"><h4>{pillar.subtitle}</h4><p>{pillar.description}</p></div>
      </article>)}</div>
        <div className="building-steps" aria-hidden="true"><i /><i /></div>
      </div>
      <div className="foundation-controls"><div className="foundation-nav" role="group" aria-label="Raise a foundation pillar">{c.pillars.items.map((pillar, i) => <button onClick={() => showPillar(i)} key={pillar.name} aria-controls={`pillar-${i}`}><span className="micro" aria-hidden="true">0{i + 1}</span>{pillar.name}</button>)}</div><div className="foundation-directions"><span className="foundation-instruction micro">Scroll to raise the pillars ↓</span><TextLink href="#ecosystem">Explore the ecosystem</TextLink></div></div>
    </div>
  </section>;
}

export function Audience() {
  const [selected, setSelected] = useState(0);
  const answer = c.audience.statements[selected];
  return <section className="audience" id="find-your-place" aria-labelledby="audience-heading">
    <div className="classroom-stage">
      <StartingCircle selected={selected} onSelect={setSelected} />
      <ClassroomCaption />
      <div className="audience-answer" id="audience-answer" aria-live="polite" aria-atomic="true"><p>{answer.answer}</p><TextLink href={answer.href}>{answer.link}</TextLink></div>
    </div>
  </section>;
}

export function Ecosystem() {
  return <section className="ecosystem section-pad" id="ecosystem" aria-labelledby="ecosystem-heading"><SectionHeading id="ecosystem-heading">{c.ecosystem.label}</SectionHeading><div className="ecosystem-intro"><RevealHeading as="p" lines={c.ecosystem.headline} /><p className="section-lead">{c.ecosystem.description}</p></div><EcosystemJourney /></section>;
}
