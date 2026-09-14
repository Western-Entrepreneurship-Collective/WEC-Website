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
  onRelease?: (direction: number) => void;
};

// Consume gestures locally: the document's scroll position does not drive
// these sequences. Each gesture advances the visible program or highlighted cell.
export function createScrollSequence(options: Options): ScrollSequence {
  const { root, section, scene, lenis, count, gestureThreshold = 90, cooldownMs = 500 } = options;
  let index = 0;
  let locked = false;
  let suppressed = false;
  let exitDirection = 0;
  let overflow = "";
  let accumulated = 0;
  let readyAt = 0;
  let pending = 0;
  let lastGesture = -Infinity;
  let lastInput = -Infinity;
  let inputDirection = 0;
  let realignFrame = 0;
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

  function unlock(direction = 0, alignExit = true) {
    if (!locked) return;
    locked = false;
    suppressed = true;
    exitDirection = direction;
    clearInput();
    document.documentElement.style.overflow = overflow;
    delete root.dataset.scrollLocked;
    options.relinquish(controller);
    options.onRelease?.(direction);
    lenis.start();
    if (alignExit && direction && measurement.trigger) lenis.scrollTo(measurement.trigger.start + direction * 4, { immediate: true, force: true });
  }

  function lock(next: number) {
    if (!measurement.trigger) return;
    suppressed = false;
    exitDirection = 0;
    inputDirection = 0;
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
    const direction = Math.sign(delta);
    const now = performance.now();
    // A reversal cancels queued travel and responds immediately, even while
    // the previous animation is settling. Old partial gestures expire.
    if (direction !== inputDirection || now - lastInput > 1500) clearInput();
    if (inputDirection && direction !== inputDirection) readyAt = now;
    inputDirection = direction;
    lastInput = now;
    if (discrete) {
      clearInput();
      const next = index + direction;
      if (next < 0 || next >= count) unlock(direction);
      else change(next);
    } else {
      accumulated += delta;
      consumeInput();
    }
  }

  function recordGesture(delta: number) {
    if (!delta || (root.dataset.scrollLocked && root.dataset.scrollLocked !== section.id)) return false;
    lastGesture = performance.now();
    if (suppressed && exitDirection && Math.sign(delta) !== exitDirection) {
      suppressed = false;
      // A small reversal beside the exit should return to the same boundary,
      // without requiring the visitor to travel away and come back first.
      if (measurement.trigger && Math.abs(window.scrollY - measurement.trigger.start) <= 48 && options.canEnter()) {
        lock(delta > 0 ? 0 : count - 1);
        return true;
      }
    }
    return false;
  }

  function onWheel(event: WheelEvent) {
    if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = event.deltaY * unit;
    const entered = recordGesture(delta);
    if (!locked) return;
    event.preventDefault();
    if (!entered) advance(delta);
  }
  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as Element;
    if (target.closest("input, textarea, select, [contenteditable=true]")) return;
    if (!locked && ["Home", "End"].includes(event.key)) { lastGesture = -Infinity; return; }
    if (event.key === " " && target.closest("button, a")) return;
    const direction = ["ArrowDown", "PageDown"].includes(event.key) ? 1 : ["ArrowUp", "PageUp"].includes(event.key) ? -1 : event.key === " " ? (event.shiftKey ? -1 : 1) : 0;
    const entered = recordGesture(direction);
    if (!locked) return;
    if (event.key === "Escape") { event.preventDefault(); unlock(1); return; }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); change(event.key === "Home" ? 0 : count - 1); return;
    }
    if (!direction) return;
    event.preventDefault();
    if (!entered) advance(direction, true);
  }
  function onTouchStart(event: TouchEvent) {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }
  function onTouchMove(event: TouchEvent) {
    if (event.defaultPrevented || !touch) return;
    if (event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    const delta = touch.y - point.clientY;
    const horizontal = Math.abs(touch.x - point.clientX) > Math.abs(delta);
    touch = { x: point.clientX, y: point.clientY };
    if (horizontal) return;
    const entered = recordGesture(delta);
    if (!locked) return;
    event.preventDefault();
    if (!entered) advance(delta);
  }
  function onTouchEnd() {
    touch = null;
  }
  function onScroll() {
    if (locked && measurement.trigger && Math.abs(window.scrollY - measurement.trigger.start) > 1) {
      const distance = window.scrollY - measurement.trigger.start;
      if (Math.abs(distance) > Math.max(innerHeight, scene.offsetHeight)) {
        // Explicit jumps to another part of the page must remain usable.
        unlock(Math.sign(distance), false);
        return;
      }
      // Browsers can scroll focused controls into view even with overflow hidden.
      lenis.scrollTo(measurement.trigger.start, { immediate: true, force: true });
      return;
    }
    if (suppressed && measurement.trigger && Math.abs(window.scrollY - measurement.trigger.start) > 48) suppressed = false;
  }
  function onFocus(event: FocusEvent) {
    lastGesture = -Infinity;
    if (locked && !section.contains(event.target as Node)) unlock();
  }

  const controller: ScrollSequence = {
    navigate: lock,
    release: () => unlock(),
    destroy() {
      unlock();
      clearInput();
      cancelAnimationFrame(realignFrame);
      measurement.trigger?.kill();
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", onTouchEnd, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
    },
  };
  const canCapture = () => {
    const age = performance.now() - lastGesture;
    // Lenis may cross the boundary on its final, rounded frame, after its
    // scrolling flag has reset. Include that settling time in the input window.
    return !locked && !suppressed && options.canEnter() && age < 2000;
  };
  measurement.trigger = ScrollTrigger.create({
    trigger: scene, start: options.start, end: "+=1", invalidateOnRefresh: true,
    // Anchor jumps, focus changes, and layout refreshes must not capture scrolling.
    onEnter: () => { if (canCapture()) lock(0); },
    onEnterBack: () => { if (canCapture()) lock(count - 1); },
    onLeave: () => { if (!locked && !suppressed) change(count - 1); },
    onLeaveBack: () => { if (!locked && !suppressed) change(0); },
    onRefreshInit: () => { lastGesture = -Infinity; },
    onRefresh: trigger => {
      if (locked) {
        cancelAnimationFrame(realignFrame);
        realignFrame = requestAnimationFrame(() => {
          if (locked) lenis.scrollTo(trigger.start, { immediate: true, force: true });
        });
      } else if (!suppressed) {
        change(window.scrollY > trigger.start ? count - 1 : 0);
      }
    },
  });
  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("focusin", onFocus);
  return controller;
}
