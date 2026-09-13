import gsap from "gsap";

// Called within the story's responsive GSAP context so all layers revert together.
export function setupSpatialStory(root: HTMLElement, desktop: boolean, wide: boolean, pinDoor: boolean) {
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const all = (selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
  const depth = desktop ? 1 : .45;

  const stage = find(".hero-stage");
  const room = find(".hero-room");
  const door = find(".studio-door");
  const frame = find(".door-frame");
  const pivot = () => ({ x: door.offsetLeft + door.offsetWidth / 2, y: door.offsetTop + frame.offsetTop + frame.offsetHeight * .48 });
  const navHeight = () => parseFloat(getComputedStyle(root).getPropertyValue("--nav-height"));
  const doorway = gsap.timeline({ scrollTrigger: {
    id: "story-doorway", trigger: stage, start: () => `top ${navHeight()}px`,
    end: () => `+=${stage.offsetHeight}`, pin: pinDoor, pinSpacing: false, refreshPriority: 2, scrub: .2, invalidateOnRefresh: true,
  } });
  // The actual About section travels underneath the opening. Removing the
  // aperture at the end reveals that content without a duplicate landing scene.
  doorway.fromTo(find(".door-handle"), { rotation: 0 }, { rotation: -24, duration: .12, ease: "power2.out" }, .01)
    .fromTo(find(".door-leaf"), { transformPerspective: 1400, z: 16, rotationY: 0 }, { transformPerspective: 1400, z: 16, rotationY: -108, duration: .6, ease: "power2.inOut" }, .04)
    .fromTo(room, { scale: 1, x: 0, y: 0, transformOrigin: () => `${pivot().x}px ${pivot().y}px` }, {
      scale: () => Math.max(stage.clientWidth / (frame.clientWidth - 28), (innerHeight - navHeight()) / (frame.clientHeight - 20)) * 1.25,
      x: () => stage.clientWidth / 2 - room.offsetLeft - pivot().x,
      y: () => (innerHeight - navHeight()) / 2 - room.offsetTop - pivot().y,
      duration: .84, ease: "power2.inOut",
    }, .2)
    .fromTo(all(".door-coordinate, .door-floor, .hero-meta, .hero-foot"), { autoAlpha: 1 }, { autoAlpha: 0, duration: .2, immediateRender: false }, .18)
    .to(find(".door-interior"), { opacity: 0, duration: .16 }, .5)
    .to(find(".door-leaf"), { opacity: 0, duration: .18 }, .64)
    .to(find(".door-aperture"), { opacity: 0, duration: .18 }, .6)
    .to(stage, { backgroundColor: "rgba(230,221,240,0)", duration: .18 }, .6)
    .set(stage, { pointerEvents: "none" }, .4);

  const proof = gsap.timeline({ scrollTrigger: { id: "story-proof", trigger: find(".about-evidence"), start: "top 92%", end: "center 52%", scrub: .45, invalidateOnRefresh: true } });
  proof.fromTo(find(".proof-guide-horizontal"), { x: -100 * depth, y: 90 * depth }, { x: 0, y: 0, duration: 1, ease: "power2.out" }, 0)
    .fromTo(find(".proof-guide-vertical"), { x: 85 * depth, y: -65 * depth }, { x: 0, y: 0, duration: 1.2, ease: "power2.out" }, 0)
    .fromTo(find(".proof-guide-corner"), { x: 65 * depth, y: -80 * depth, scale: 1.8 }, { x: 0, y: 0, scale: 1, duration: 1.1, ease: "power2.out" }, .1)
    .fromTo(find(".proof-guides"), { opacity: .1 }, { opacity: .35, duration: 1 }, 0)
    .fromTo(find(".evidence-number"), { opacity: .5 }, { opacity: 1, duration: .8 }, .2);

  const map = find(".ecosystem-map");
  const camera = find(".ecosystem-camera");
  const ecosystem = gsap.timeline({ scrollTrigger: {
    id: "story-ecosystem", trigger: map, start: "top 85%", end: "top 45%", scrub: .2, invalidateOnRefresh: true,
  } });
  // Move the complete diagram as one surface so arrows never detach from cards.
  ecosystem.fromTo(camera, { scale: .96, y: 18 }, { scale: 1, y: 0, duration: 1, ease: "power1.out" });

  const join = gsap.timeline({ scrollTrigger: { id: "story-arrival", trigger: find(".join-composition"), start: "top 95%", end: wide ? "center 65%" : "top 20%", scrub: .55, invalidateOnRefresh: true } });
  const offsets = [[-160, -100, 220], [170, -65, -180], [-100, 145, -120], [160, 120, 280]];
  all(".join-fragment").forEach((fragment, i) => {
    const [x, y, z] = offsets[i];
    join.fromTo(fragment, { x: x * depth, y: y * depth, z: z * depth, rotation: i % 2 ? 9 : -7, opacity: .5 }, { x: 0, y: 0, z: 0, rotation: 0, duration: .75 + i * .06, ease: "power2.out" }, i * .025)
      .to(fragment, { opacity: 0, duration: .16 }, .94);
  });
  all(".join-frame .frame-edge").forEach((edge, i) => {
    const [x, y, z] = offsets[i];
    join.fromTo(edge, { x: x * depth * .55, y: y * depth * .5, z: -z * depth, scaleX: .65, scaleY: .65, opacity: .08 }, { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, opacity: .45, duration: .8, ease: "power2.out" }, .15 + i * .03);
  });
  join.fromTo(root.querySelectorAll(".join-frame .registration"), { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: .2 }, .85);

  gsap.fromTo(find(".community-poster"), { rotation: -3, y: 35 }, { rotation: -1, y: 0, ease: "power2.out", scrollTrigger: { trigger: find(".community-wall"), start: "top 90%", end: "top 35%", scrub: .5 } });
  gsap.fromTo(find(".community-photo-detail"), { rotation: 7, y: 55 }, { rotation: 3, y: -12, ease: "power2.out", scrollTrigger: { trigger: find(".community-wall"), start: "top 85%", end: "center 50%", scrub: .5 } });
}
