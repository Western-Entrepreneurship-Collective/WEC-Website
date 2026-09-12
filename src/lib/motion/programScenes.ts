import gsap from "gsap";
import type Lenis from "lenis";
import { createScrollSequence, type ScrollSequence } from "./scrollSequence";

type Controls = {
  canEnter: () => boolean;
  claim: (sequence: ScrollSequence) => void;
  relinquish: (sequence: ScrollSequence) => void;
};

const EXPERIENCE_SCROLL_SPEED = 5;

export function setupProgramScenes(root: HTMLElement, lenis: Lenis, controls: Controls) {
  const experienceSection = root.querySelector<HTMLElement>(".experience")!;
  const windows = [...root.querySelectorAll<HTMLElement>(".program-window")];
  const nav = [...root.querySelectorAll<HTMLButtonElement>(".experience-nav button")];
  let initialized = false;
  let activeProgram = -1;
  experienceSection.dataset.sequence = "true";

  function showProgram(index: number) {
    if (activeProgram === index) return;
    activeProgram = index;
    experienceSection.dataset.activeProgram = String(index);
    windows.forEach((card, i) => {
      if (i !== index && card.contains(document.activeElement)) nav[index].focus({ preventScroll: true });
      card.inert = i !== index;
      if (i !== index) card.setAttribute("aria-hidden", "true");
      else card.removeAttribute("aria-hidden");
      if (i === index) nav[i].setAttribute("aria-current", "true");
      else nav[i].removeAttribute("aria-current");
      const position = { yPercent: i > index ? 115 : 0, y: i * 16, z: i > index ? 180 : (i - index) * 70, rotationX: i > index ? -9 : i < index ? 2 : 0, rotation: 0 };
      if (initialized) gsap.to(card, { ...position, duration: .2, ease: "power2.out", overwrite: true });
      else gsap.set(card, position);
    });
    if (nav.some(button => button === document.activeElement)) nav[index].focus({ preventScroll: true });
    initialized = true;
  }
  const fieldSection = root.querySelector<HTMLElement>(".field")!;
  const people = [...root.querySelectorAll<HTMLElement>(".field-person")];
  const list = root.querySelector<HTMLElement>(".field-list-scroll")!;
  const echoes = [...root.querySelectorAll<HTMLElement>(".field-echo-word")];
  const focusLine = root.querySelector<HTMLElement>(".field-focus-line")!;
  let previousPerson = 0;
  let fieldInitialized = false;
  fieldSection.dataset.sequence = "true";
  function showPerson(index: number) {
    const direction = Math.sign(index - previousPerson) || 1;
    echoes.forEach((echo, i) => {
      if (!fieldInitialized) gsap.set(echo, { autoAlpha: i === index ? 1 : 0, xPercent: 0, z: -90 });
      else if (i === index) gsap.fromTo(echo, { xPercent: direction * 12, z: -180, autoAlpha: 0 }, { xPercent: 0, z: -90, autoAlpha: 1, duration: .3, ease: "power2.out", overwrite: true });
      else gsap.to(echo, { xPercent: -direction * 16, autoAlpha: 0, duration: .2, overwrite: true });
    });
    const gutter = focusLine.offsetLeft;
    const focusX = (fieldSection.clientWidth - gutter * 2 - 24) * index / (people.length - 1);
    if (fieldInitialized) gsap.to(focusLine, { x: focusX, duration: .14, ease: "power2.out", overwrite: true });
    else gsap.set(focusLine, { x: focusX });
    previousPerson = index;
    fieldInitialized = true;
    fieldSection.dataset.activePerson = String(index);
    fieldSection.dispatchEvent(new CustomEvent("wec:field-state", { detail: index }));
    people.forEach((person, i) => {
      person.classList.toggle("is-active", i === index);
      if (i === index) person.querySelector("button")!.setAttribute("aria-current", "true");
      else person.querySelector("button")!.removeAttribute("aria-current");
    });
    const target = people[index].getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - (list.clientWidth - people[index].offsetWidth) / 2;
    gsap.to(list, { scrollLeft: Math.max(0, Math.min(target, list.scrollWidth - list.clientWidth)), duration: .14, overwrite: true });
  }
  showProgram(0);
  showPerson(0);
  // One sequence owns the document lock: Studio, Labs, then five field views.
  // The third window stays still while its highlights advance.
  const experience = createScrollSequence({
    root, section: experienceSection, scene: root.querySelector<HTMLElement>(".experience-stage")!,
    start: () => `top ${parseFloat(getComputedStyle(root).getPropertyValue("--nav-height")) + 10}px`,
    count: 2 + people.length, lenis, ...controls,
    onChange: index => { showProgram(Math.min(index, 2)); if (index >= 2) showPerson(index - 2); },
    gestureThreshold: index => (index >= 2 ? 18 : 90) / EXPERIENCE_SCROLL_SPEED,
    cooldownMs: index => index >= 2 ? 60 : 120,
    retainInput: true,
  });
  const onProgram = (event: Event) => {
    const index = (event as CustomEvent<number>).detail;
    if (Number.isInteger(index) && index >= 0 && index < windows.length) experience.navigate(index);
  };
  experienceSection.addEventListener("wec:program", onProgram);
  const onPerson = (event: Event) => {
    const index = (event as CustomEvent<number>).detail;
    if (Number.isInteger(index) && index >= 0 && index < people.length) experience.navigate(index + 2);
  };
  experienceSection.addEventListener("wec:person", onPerson);

  return { experience, dispose() {
    experience.destroy();
    experienceSection.removeEventListener("wec:program", onProgram);
    experienceSection.removeEventListener("wec:person", onPerson);
    gsap.killTweensOf(windows); gsap.killTweensOf(list); gsap.killTweensOf(echoes); gsap.killTweensOf(focusLine);
    gsap.set([...echoes, focusLine], { clearProps: "transform,opacity,visibility" });
    windows.forEach(card => { card.inert = false; card.removeAttribute("aria-hidden"); gsap.set(card, { clearProps: "transform" }); });
    nav.forEach(button => button.removeAttribute("aria-current"));
    people.forEach((person, i) => {
      person.classList.toggle("is-active", i === 0);
      if (i === 0) person.querySelector("button")!.setAttribute("aria-current", "true");
      else person.querySelector("button")!.removeAttribute("aria-current");
    });
    list.scrollLeft = 0;
    fieldSection.dispatchEvent(new CustomEvent("wec:field-state", { detail: 0 }));
    delete experienceSection.dataset.sequence; delete experienceSection.dataset.activeProgram;
    delete fieldSection.dataset.sequence; delete fieldSection.dataset.activePerson;
  } };
}
