import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { setupProgramScenes } from "./programScenes";
import type { ScrollSequence } from "./scrollSequence";
import { setupSpatialStory } from "./spatial";
import { setupFoundationScene } from "./foundationScene";
import { PAGE_SCROLL_SLOWDOWN } from "./pacing";

gsap.registerPlugin(ScrollTrigger);

export function setupStory(root: HTMLDivElement) {
  const select = gsap.utils.selector(root);
  const media = gsap.matchMedia();
  let alive = true;
  let refreshFrame = 0;
  let navigationFrame = 0;
  let activeSequence: ScrollSequence | undefined;
  let experienceSequence: ScrollSequence | undefined;
  let foundationSequence: ScrollSequence | undefined;
  let navigating = false;
  const lenis: Lenis = new Lenis({
    lerp: .18 / PAGE_SCROLL_SLOWDOWN, wheelMultiplier: 1.7 / PAGE_SCROLL_SLOWDOWN, touchMultiplier: 1.5 / PAGE_SCROLL_SLOWDOWN,
    syncTouch: true, syncTouchLerp: .18 / PAGE_SCROLL_SLOWDOWN, smoothWheel: true, autoRaf: false, anchors: false,
    virtualScroll: ({ deltaY, event }) => {
      // A gesture consumed by a scene must not also move the page on release.
      if (event.defaultPrevented) return false;
      if (event.type === "wheel" && !event.ctrlKey && deltaY && lenis.velocity && Math.sign(deltaY) !== Math.sign(lenis.velocity)) {
        lenis.scrollTo(window.scrollY, { immediate: true, force: true });
      }
      return true;
    },
  });
  const tick = (time: number) => lenis.raf(time * 1000);
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(tick);
  const modalObserver = new MutationObserver(() => {
    if (root.querySelector("dialog[open], .menu-is-open")) { activeSequence?.release(); lenis.stop(); }
    else if (!activeSequence) lenis.start();
  });
  root.querySelectorAll("dialog").forEach(dialog => modalObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  const header = root.querySelector(".site-header");
  if (header) modalObserver.observe(header, { attributes: true, attributeFilter: ["class"] });

  function scrollToHash(hash: string, immediate = false, focus = false) {
    const target = document.getElementById(decodeURIComponent(hash.replace(/^#/, "")));
    if (!target) return;
    navigating = true;
    activeSequence?.release();
    const program = target.closest<HTMLElement>(".program-window");
    if (program && experienceSequence) {
      experienceSequence.navigate([...root.querySelectorAll(".program-window")].indexOf(program));
      if (focus) program.querySelector<HTMLElement>(".program-window-body")?.focus({ preventScroll: true });
      navigating = false;
      return;
    }
    const pillar = target.closest<HTMLElement>(".pillar-panel");
    if (pillar && foundationSequence) {
      foundationSequence.navigate([...root.querySelectorAll(".pillar-panel")].indexOf(pillar) + 1);
      navigating = false;
      return;
    }
    if (focus) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    const navigationOffset = parseFloat(getComputedStyle(root).getPropertyValue("--nav-height")) + (target.id === "find-your-place" ? 0 : 16);
    // Numeric destinations avoid counting CSS scroll margins/padding again in Lenis.
    const destination = hash === "#hero" ? 0 : target.getBoundingClientRect().top + window.scrollY - navigationOffset;
    lenis.scrollTo(destination, { immediate, force: true, duration: .65 * PAGE_SCROLL_SLOWDOWN, onComplete: () => { navigating = false; } });
  }

  function onNavigationInput(event: WheelEvent | TouchEvent | KeyboardEvent) {
    if (!navigating || event.defaultPrevented) return;
    if (event instanceof WheelEvent && (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY))) return;
    if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey || event.altKey || !["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key) || (event.target as Element).closest("input, textarea, select, [contenteditable=true]"))) return;
    navigating = false;
    cancelAnimationFrame(navigationFrame);
    lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  }

  function onAnchor(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor || anchor.classList.contains("skip-link")) return;
    const hash = anchor.getAttribute("href");
    if (!hash || hash === "#" || !document.getElementById(hash.substring(1))) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, "", hash);
    cancelAnimationFrame(navigationFrame);
    if (anchor.closest(".mobile-menu")) {
      navigating = true;
      navigationFrame = requestAnimationFrame(() => scrollToHash(hash, false, true));
    } else scrollToHash(hash, false, true);
  }
  const onPopState = () => { cancelAnimationFrame(navigationFrame); activeSequence?.release(); scrollToHash(location.hash || "#hero", true); };
  const onPageShow = () => ScrollTrigger.refresh();
  root.addEventListener("click", onAnchor);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("wheel", onNavigationInput, { passive: true, capture: true });
  window.addEventListener("touchstart", onNavigationInput, { passive: true, capture: true });
  window.addEventListener("keydown", onNavigationInput, true);

  const context = gsap.context(() => {
    // One restrained entrance. No loading screen, and no delayed access to copy.
    if (window.scrollY < 80 && (!location.hash || location.hash === "#hero")) {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.from(".door-frame", { y: 18, opacity: .5, duration: .8 })
        .from(".hero-mark", { opacity: 0, y: 16, duration: .9 }, .15)
        .from(".hero-full-name", { opacity: 0, y: 10, duration: .7 }, .3)
        .from(".hero-positioning .reveal-line", { yPercent: 110, duration: .9, stagger: .12 }, .4);
    }

    select(".reveal-heading:not(.hero-positioning)").forEach((heading: HTMLElement) => {
      gsap.from(heading.querySelectorAll(".reveal-line"), {
        yPercent: 110, duration: .85, stagger: .12, ease: "power3.out",
        scrollTrigger: { trigger: heading, start: "top 92%", once: true },
      });
    });
    root.querySelectorAll<SVGSVGElement>(".venture-line").forEach(line => {
      gsap.fromTo(line.querySelector("path"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: line, start: "top 90%", end: "bottom 65%", scrub: .5 } });
    });
  }, root);

  media.add({ desktop: "(min-width: 960px) and (min-height: 500px)", wide: "(min-width: 760px)", tall: "(min-height: 600px)", journeyHeight: "(min-height: 640px)", roomForScenes: "(min-height: 640px), (min-width: 960px) and (min-height: 500px)", compactBuilding: "(max-width: 1199px), (max-height: 959px)", always: "all" }, condition => {
    const isDesktop = !!condition.conditions?.desktop;
    if (isDesktop) root.dataset.storyDesktop = "true";
    if (condition.conditions?.roomForScenes) root.dataset.scrollScenes = "true";
    root.dataset.spatialStory = "true";
    const desktop = gsap.context(() => {
      setupSpatialStory(root, isDesktop, !!condition.conditions?.wide, isDesktop || !!condition.conditions?.tall);

      // Short screens keep programs and pillar copy in document flow.
      // They retain decorative motion without trapping content below the viewport.
      if (!condition.conditions?.roomForScenes) return;

      const controls = {
        canEnter: () => !activeSequence && !navigating && !root.querySelector('dialog[open], .menu-is-open'),
        claim: (sequence: ScrollSequence) => { activeSequence?.release(); activeSequence = sequence; },
        relinquish: (sequence: ScrollSequence) => { if (activeSequence === sequence) activeSequence = undefined; },
      };
      const scenes = setupProgramScenes(root, lenis, controls);
      const foundation = setupFoundationScene(root, lenis, controls);
      experienceSequence = scenes.experience;
      foundationSequence = foundation.sequence;
      return () => { scenes.dispose(); foundation.dispose(); experienceSequence = undefined; foundationSequence = undefined; };
    }, root);

    return () => {
      desktop.revert();
      gsap.set(root.querySelectorAll(".ecosystem-scene-stage, .arrival-directory, .journey-welcome, .journey-instruction, .audience"), { clearProps: "transform,transformOrigin,opacity,visibility,backgroundColor,pointerEvents" });
      const journey = root.querySelector<HTMLElement>(".ecosystem-scene");
      if (journey) journey.dataset.progress = "0";
      // Release the foundation entrance for the linear reading layout.
      gsap.set(root.querySelectorAll(".pillar-panel"), { clearProps: "transform,opacity,visibility" });
      // Scrubbed from/to values can leave their neutral transform inline.
      // Return the door to its CSS pose when changing modes or breakpoints.
      gsap.set(root.querySelectorAll(".hero-room, .door-leaf, .door-handle"), { clearProps: "transform,transformOrigin,opacity" });
      gsap.set(root.querySelectorAll(".door-coordinate, .door-floor, .hero-meta, .hero-foot"), { clearProps: "opacity,visibility" });
      gsap.set(root.querySelector(".hero-stage"), { clearProps: "backgroundColor,pointerEvents" });
      delete root.dataset.storyDesktop;
      delete root.dataset.scrollScenes;
      delete root.dataset.spatialStory;
    };
  });

  media.add("(min-width: 960px) and (pointer: fine)", () => {
    const cleanups: (() => void)[] = [];
    const pointerContext = gsap.context(() => {
      select("[data-pointer-area]").forEach((area: HTMLElement) => {
        const layers = [...area.querySelectorAll<HTMLElement>("[data-depth]")].map(element => ({
          element, depth: Number(element.dataset.depth),
          x: gsap.quickTo(element, "x", { duration: .65, ease: "power2.out" }),
          y: gsap.quickTo(element, "y", { duration: .65, ease: "power2.out" }),
        }));
        let frame = 0;
        let lastX = 0;
        let lastY = 0;
        let bounds = area.getBoundingClientRect();
        const onEnter = () => { bounds = area.getBoundingClientRect(); };
        const onMove = (event: PointerEvent) => {
          lastX = ((event.clientX - bounds.left) / bounds.width - .5) * 14;
          lastY = ((event.clientY - bounds.top) / bounds.height - .5) * 14;
          if (!frame) frame = requestAnimationFrame(() => {
            layers.forEach(layer => { layer.x(lastX * layer.depth); layer.y(lastY * layer.depth); });
            frame = 0;
          });
        };
        const onLeave = () => { cancelAnimationFrame(frame); frame = 0; layers.forEach(layer => { layer.x(0); layer.y(0); }); };
        area.addEventListener("pointerenter", onEnter);
        area.addEventListener("pointermove", onMove);
        area.addEventListener("pointerleave", onLeave);
        cleanups.push(() => { cancelAnimationFrame(frame); area.removeEventListener("pointerenter", onEnter); area.removeEventListener("pointermove", onMove); area.removeEventListener("pointerleave", onLeave); });
      });
    }, root);
    return () => { cleanups.forEach(cleanup => cleanup()); pointerContext.revert(); };
  });

  // Re-measure after local fonts load. Anchor entry and reload positions remain
  // correct even though desktop pinning changes document height.
  document.fonts.ready.then(() => {
    if (!alive) return;
    refreshFrame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      lenis.resize();
      if (location.hash) scrollToHash(location.hash, true);
    });
  });

  return () => {
    alive = false;
    cancelAnimationFrame(refreshFrame);
    cancelAnimationFrame(navigationFrame);
    root.removeEventListener("click", onAnchor);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("wheel", onNavigationInput, true);
    window.removeEventListener("touchstart", onNavigationInput, true);
    window.removeEventListener("keydown", onNavigationInput, true);
    media.revert();
    context.revert();
    gsap.ticker.remove(tick);
    modalObserver.disconnect();
    lenis.off("scroll", ScrollTrigger.update);
    lenis.destroy();
    delete root.dataset.storyDesktop;
  };
}
