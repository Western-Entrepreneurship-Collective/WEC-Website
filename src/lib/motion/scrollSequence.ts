import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

export type ScrollSequence = {
  navigate: (index: number) => void;
  release: () => void;
  destroy: () => void;
};

type Options = {
  root: HTMLElement;
  section: HTMLElement;
  scene: HTMLElement;
  start: string | (() => string);
  count: number;
  lenis: Lenis;
  canEnter: () => boolean;
  claim: (sequence: ScrollSequence) => void;
  relinquish: (sequence: ScrollSequence) => void;
  onChange: (index: number) => void;
  gestureThreshold?: number | ((index: number) => number);
  cooldownMs?: number | ((index: number) => number);
  retainInput?: boolean;
  onRelease?: () => void;
};

// Consume gestures locally: the document's scroll position does not drive
// these sequences. Each gesture advances the visible program or highlighted cell.
export function createScrollSequence(options: Options): ScrollSequence {
  const { root, section, scene, lenis, count, gestureThreshold = 90, cooldownMs = 500 } = options;
  let index = 0;
  let locked = false;
  let suppressed = false;
  let overflow = "";
  let accumulated = 0;
  let readyAt = 0;
  let pending = 0;
  let lastGesture = -Infinity;
  let touch: { x: number; y: number } | null = null;
  const measurement: { trigger?: ScrollTrigger } = {};

  function clearInput() {
    window.clearTimeout(pending);
    pending = 0;
    accumulated = 0;
  }

  function change(next: number, preserveInput = false) {
    index = next;
    if (!preserveInput) clearInput();
    readyAt = performance.now() + (typeof cooldownMs === "function" ? cooldownMs(index) : cooldownMs);
    options.onChange(index);
  }

  function unlock(direction = 0) {
    if (!locked) return;
    locked = false;
    suppressed = true;
    clearInput();
    document.documentElement.style.overflow = overflow;
    delete root.dataset.scrollLocked;
    options.relinquish(controller);
    options.onRelease?.();
    lenis.start();
    if (direction && measurement.trigger) lenis.scrollTo(measurement.trigger.start + direction * 4, { immediate: true, force: true });
  }

  function lock(next: number) {
    if (!measurement.trigger) return;
    if (!locked) {
      options.claim(controller);
      locked = true;
      overflow = document.documentElement.style.overflow;
      lenis.stop();
      document.documentElement.style.overflow = "hidden";
      root.dataset.scrollLocked = section.id;
    }
    // Explicit navigation also realigns a scene after browser focus scrolling.
    lenis.scrollTo(measurement.trigger.start, { immediate: true, force: true });
    change(Math.max(0, Math.min(count - 1, next)));
  }

  function consumeInput() {
    window.clearTimeout(pending);
    pending = 0;
    if (!locked || !accumulated) return;
    const delay = readyAt - performance.now();
    if (delay > 0) { pending = window.setTimeout(consumeInput, delay); return; }
    const threshold = typeof gestureThreshold === "function" ? gestureThreshold(index) : gestureThreshold;
    // Native input may arrive as float32 values, including fractional pixels.
    if (Math.abs(accumulated) + 1e-4 < threshold) return;
    const direction = Math.sign(accumulated);
    const next = index + direction;
    if (next < 0 || next >= count) { unlock(direction); return; }
    accumulated -= direction * threshold;
    if (Math.abs(accumulated) < 1e-4) accumulated = 0;
    change(next, true);
    // A large gesture can visit every step, but its surplus must not carry
    // the reader out of the scene. A fresh gesture leaves the final step.
    if (next === 0 || next === count - 1) clearInput();
    else if (accumulated) pending = window.setTimeout(consumeInput, Math.max(0, readyAt - performance.now()));
  }

  function advance(delta: number, discrete = false) {
    if (!locked || !delta) return;
    if (!discrete && options.retainInput) {
      if (accumulated && Math.sign(accumulated) !== Math.sign(delta)) clearInput();
      accumulated += delta;
      consumeInput();
      return;
    }
    if (!discrete && performance.now() < readyAt) return;
    if (Math.sign(accumulated) !== Math.sign(delta)) accumulated = 0;
    accumulated += delta;
    const threshold = typeof gestureThreshold === "function" ? gestureThreshold(index) : gestureThreshold;
    if (!discrete && Math.abs(accumulated) < threshold) return;
    const direction = Math.sign(delta);
    const next = index + direction;
    if (next < 0 || next >= count) unlock(direction);
    else change(next);
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    lastGesture = performance.now();
    if (!locked) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    advance(event.deltaY * unit);
  }
  function onKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as Element;
    if (target.closest("input, textarea, select, [contenteditable=true]")) return;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)) lastGesture = performance.now();
    if (!locked) return;
    if (event.key === "Escape") { event.preventDefault(); unlock(1); return; }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); change(event.key === "Home" ? 0 : count - 1); return;
    }
    if (event.key === " " && target.closest("button, a")) return;
    const direction = ["ArrowDown", "PageDown", " "].includes(event.key) ? (event.shiftKey ? -1 : 1) : ["ArrowUp", "PageUp"].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    advance(direction * (event.key.startsWith("Arrow") ? 100 : innerHeight * .65), true);
  }
  function onTouchStart(event: TouchEvent) {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }
  function onTouchMove(event: TouchEvent) {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    const delta = touch.y - point.clientY;
    const horizontal = Math.abs(touch.x - point.clientX) > Math.abs(delta);
    touch = { x: point.clientX, y: point.clientY };
    if (horizontal) return;
    lastGesture = performance.now();
    if (!locked) return;
    event.preventDefault(); advance(delta);
  }
  function onScroll() {
    if (suppressed && measurement.trigger && Math.abs(window.scrollY - measurement.trigger.start) > 48) suppressed = false;
  }
  function onFocus(event: FocusEvent) {
    if (locked && !section.contains(event.target as Node)) unlock();
  }

  const controller: ScrollSequence = {
    navigate: lock,
    release: () => unlock(),
    destroy() {
      unlock();
      measurement.trigger?.kill();
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
    },
  };
  measurement.trigger = ScrollTrigger.create({
    trigger: scene, start: options.start, end: "+=1", invalidateOnRefresh: true,
    // Anchor jumps, focus changes, and layout refreshes must not capture scrolling.
    onEnter: () => { if (!locked && !suppressed && performance.now() - lastGesture < 700 && options.canEnter()) lock(0); },
    onEnterBack: () => { if (!locked && !suppressed && performance.now() - lastGesture < 700 && options.canEnter()) lock(count - 1); },
  });
  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("focusin", onFocus);
  return controller;
}
