import gsap from "gsap";
import type Lenis from "lenis";
import { createScrollSequence, type ScrollSequence } from "./scrollSequence";
import { PILLAR_COOLDOWN, PILLAR_GESTURE, PILLAR_TRANSITION } from "./pacing";

export function setupFoundationScene(root: HTMLElement, lenis: Lenis, controls: {
  canEnter: () => boolean;
  claim: (sequence: ScrollSequence) => void;
  relinquish: (sequence: ScrollSequence) => void;
}) {
  const section = root.querySelector<HTMLElement>(".pillars")!;
  const scene = section.querySelector<HTMLElement>(".foundation-scene")!;
  const columns = [...section.querySelectorAll<HTMLElement>(".building-column")];
  const panels = [...section.querySelectorAll<HTMLElement>(".pillar-panel")];
  const buttons = [...section.querySelectorAll<HTMLButtonElement>(".foundation-nav button")];
  const roof = section.querySelector<HTMLElement>(".building-roof")!;
  const steps = section.querySelector<HTMLElement>(".building-steps")!;
  const instruction = section.querySelector<HTMLElement>(".foundation-instruction")!;
  const compact = matchMedia("(max-width: 1199px), (max-height: 959px)").matches;
  section.dataset.sequence = "true";

  function show(raised: number, immediate = false) {
    const selected = Math.max(0, raised - 1);
    section.dataset.raisedPillars = String(raised);
    instruction.textContent = raised === 5 ? "All five. One collective. ↓" : "Scroll to raise the next pillar ↓";
    columns.forEach((column, i) => {
      column.classList.toggle("is-raised", i < raised);
      const pose = { yPercent: i < raised ? 0 : 103 };
      if (immediate) gsap.set(column, pose);
      else gsap.to(column, { ...pose, duration: PILLAR_TRANSITION, ease: "power2.out", overwrite: true });
      const visible = raised > 0 && (compact ? i === selected : i < raised);
      const textPose = { autoAlpha: visible ? 1 : 0, y: visible ? 0 : 16 };
      if (immediate) gsap.set(panels[i], textPose);
      else gsap.to(panels[i], { ...textPose, duration: PILLAR_TRANSITION, overwrite: true });
      if (i === selected && raised > 0) buttons[i].setAttribute("aria-current", "true");
      else buttons[i].removeAttribute("aria-current");
    });
    const structurePose = { autoAlpha: raised > 0 ? 1 : 0 };
    if (immediate) gsap.set([roof, steps], structurePose);
    else gsap.to([roof, steps], { ...structurePose, duration: PILLAR_TRANSITION, ease: "power2.out", overwrite: true });
  }
  show(0, true);
  const sequence = createScrollSequence({
    root, section, scene, lenis, ...controls,
    start: () => `top ${parseFloat(getComputedStyle(root).getPropertyValue("--nav-height")) + 14}px`,
    count: 6, onChange: raised => show(raised), gestureThreshold: PILLAR_GESTURE, cooldownMs: PILLAR_COOLDOWN,
    onRelease: direction => show(direction < 0 ? 0 : 5),
  });
  const onPillar = (event: Event) => {
    const index = (event as CustomEvent<number>).detail;
    if (Number.isInteger(index) && index >= 0 && index < 5) sequence.navigate(index + 1);
  };
  section.addEventListener("wec:pillar", onPillar);
  return { sequence, dispose() {
    sequence.destroy();
    section.removeEventListener("wec:pillar", onPillar);
    gsap.killTweensOf([...columns, ...panels, roof, steps]);
    gsap.set([...columns, ...panels, roof, steps], { clearProps: "transform,opacity,visibility" });
    columns.forEach(column => column.classList.remove("is-raised"));
    buttons.forEach(button => button.removeAttribute("aria-current"));
    instruction.textContent = "Scroll to raise the pillars ↓";
    delete section.dataset.sequence;
    delete section.dataset.raisedPillars;
  } };
}
