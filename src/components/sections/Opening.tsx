"use client";

import { useRef } from "react";
import Image from "next/image";
import { Arrow, MeasureTicks } from "@/components/graphics/DraftGraphics";
import { RevealHeading, SectionHeading, TextLink } from "@/components/ui/Editorial";
import { siteContent as c } from "@/data/siteContent";
import { ProofGuides } from "@/components/graphics/StoryLayers";
import { Spark, StartingNote } from "@/components/graphics/StudioGraphics";
import { StudioDoor } from "@/components/graphics/StudioDoor";
import { FieldHighlights } from "./Programs";

export function Hero() {
  return <section className="hero" id="hero" aria-labelledby="hero-heading">
    <div className="hero-stage">
      <div className="hero-meta micro"><span>{c.hero.location}</span><span>Fig. 00 <span className="meta-dash">—</span> {c.hero.index}</span></div>
      <div className="hero-composition hero-room">
        <StudioDoor />
      </div>
      <div className="hero-foot micro"><span>{c.hero.footer}</span><MeasureTicks /><a href="#about" className="scroll-cue">Scroll to step inside <Arrow down /></a></div>
    </div>
  </section>;
}

export function About() {
  return <section className="about section-pad" id="about" aria-labelledby="about-heading">
    <div className="about-grid">
      <div className="about-copy">
        <SectionHeading id="about-heading">{c.about.label}</SectionHeading>
        <div className="about-statement"><RevealHeading as="p" lines={c.about.headline} /></div>
        <div className="about-description"><p className="body-large">{c.about.description}</p><p>{c.about.founders}</p></div>
        <StartingNote />
      </div>
      <div className="about-evidence"><ProofGuides /><div className="evidence-top micro"><span>A little proof of possibility</span><span aria-hidden="true">↙</span></div><p className="evidence-number">{c.about.evidence.replace("+", "")}<span>+</span></p><div className="evidence-caption"><span className="micro">{c.about.evidenceLabel}</span><p>{c.about.evidenceNote}</p></div><div className="evidence-postscript"><Spark /><span>Small starts.<br />Real possibilities.</span></div></div>
    </div>
  </section>;
}

export function Experience() {
  const sectionRef = useRef<HTMLElement>(null);
  function showProgram(index: number) {
    const section = sectionRef.current;
    if (section?.dataset.sequence === "true") section.dispatchEvent(new CustomEvent("wec:program", { detail: index }));
    else document.getElementById(`experience-program-${index}`)?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  return <section className="experience brand-section" id="experience" aria-labelledby="experience-heading" ref={sectionRef}>
    <div className="experience-intro section-pad">
      <span className="studio-status micro"><i /> Ideas welcome. Work in progress, too.</span>
    </div>
    <div className="experience-stack">
      <div className="experience-stage">
        <h2 className="section-heading scene-title" id="experience-heading">{c.experience.label}</h2>
        <div className="experience-nav" role="group" aria-label="Explore the WEC programs">{c.experience.programs.map((program, i) => <button key={program.number} onClick={() => showProgram(i)} aria-controls={`experience-program-${i}`}><span className="micro">{program.number}</span>{program.name}</button>)}</div>
        <div className="experience-windows">{c.experience.programs.map((program, i) => <article className={`program-window program-window-${i}`} id={`experience-program-${i}`} key={program.number} aria-labelledby={`program-heading-${i}`}>
          <div className="program-window-bar"><span className="window-marks" aria-hidden="true">{[0, 1, 2].map(dot => <i key={dot} className={dot <= i ? "is-filled" : undefined} />)}</span><span className="micro">WEC experience</span><span className="micro">{program.number} / 03</span></div>
          <div className={`program-window-body${i === 2 ? " program-window-field" : " program-window-with-photo"}`} id={i === 0 ? "venture-studio" : i === 1 ? "founder-labs" : "from-the-field"} tabIndex={-1}>
            <div className="program-window-copy">
              <div className="program-window-heading"><h3 id={`program-heading-${i}`}><span className="program-window-number" aria-hidden="true">{program.number}</span>{program.name}</h3><p className="program-window-tagline">{i === 0 ? c.studio.headline.join(" ") : i === 1 ? c.labs.headline.join(" ") : program.description}</p></div>
              <div className="program-window-description"><p className="section-lead">{i === 0 ? c.studio.description : i === 1 ? c.labs.description : c.field.description}</p>{i < 2 && <p className="program-details">{i === 0 ? c.studio.details : c.labs.outputs}</p>}</div>
            </div>
            {i < 2 && <figure className="program-window-media"><Image src={i === 0 ? "/images/venture-studio.jpg" : "/images/founder-labs.jpg"} alt={i === 0 ? "Students working together around shared tables in an entrepreneurship space." : "A workshop speaker leading a discussion with students around a table."} fill sizes="(max-width: 759px) 90vw, 42vw" /><figcaption className="micro">{i === 0 ? "Ideas meet action." : "Learn by working it through."}</figcaption></figure>}
            {i === 2 && <FieldHighlights />}
          </div>
          <div className="program-window-footer"><span>{program.note}</span>{i < 2 ? <button className="text-link" onClick={() => showProgram(i + 1)}>Next: {c.experience.programs[i + 1].name}<Arrow /></button> : <TextLink href="#community" diagonal>Meet the WEC community</TextLink>}</div>
        </article>)}</div>
      </div>
    </div>
  </section>;
}
