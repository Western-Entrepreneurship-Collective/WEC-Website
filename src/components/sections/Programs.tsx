"use client";

import { useEffect, useRef, useState } from "react";
import { siteContent as c } from "@/data/siteContent";
import { FieldDepth } from "@/components/graphics/StoryLayers";

export function FieldHighlights() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    const field = fieldRef.current!;
    const onSelection = (event: Event) => setSelected((event as CustomEvent<number>).detail);
    field.addEventListener("wec:field-state", onSelection);
    return () => field.removeEventListener("wec:field-state", onSelection);
  }, []);
  function showPerson(index: number) {
    const experience = fieldRef.current?.closest<HTMLElement>(".experience");
    if (experience?.dataset.sequence === "true") experience.dispatchEvent(new CustomEvent("wec:person", { detail: index }));
    else setSelected(index);
  }
  return <div className="field field-sequence" ref={fieldRef}>
    <FieldDepth people={c.field.people} />
    <div className="field-sequence-heading"><p className="field-sequence-label">People you can learn from</p><span className="field-progress micro" aria-hidden="true">{`0${selected + 1} / 05`}</span></div>
    <div className="field-list-scroll"><ul className="field-people">{c.field.people.map((person, i) => <li key={person} className={`field-person${i === selected ? " is-active" : ""}`}><button onClick={() => showPerson(i)} aria-current={i === selected ? "true" : undefined}><span className="micro" aria-hidden="true">0{i + 1}</span><span>{person}</span><span className="field-person-line" aria-hidden="true" /></button></li>)}</ul></div>
    <span className="field-scroll-hint micro">Scroll to meet the next perspective <span aria-hidden="true">↓</span></span>
  </div>;
}
