# Verification record

Verified locally on Windows on 2026-09-12.

## Automated checks

| Check | Result |
| --- | --- |
| ESLint | Passed, no errors or warnings |
| TypeScript | Passed |
| Production build | Passed; homepage statically prerendered |
| Playwright | 80 passed across five browser/device profiles |
| Axe | No detected violations in the configured WCAG A/AA and accessible-label checks |
| Asset provenance | All four supplied acronym/lockup PNGs match the source files byte-for-byte |
| Dependency audit at installation | No reported vulnerabilities |

Browser profiles: desktop Chromium, Firefox, and WebKit at 1440 × 1000; Chromium and WebKit mobile emulation at 390 × 844. WebKit testing is browser-engine coverage, not a claim that physical Safari/iPhone devices were tested.

The sixteen scenarios cover section order, internal anchors, image availability, page overflow, audience selection, dialogs, keyboard focus, motion preferences and cleanup, and direct-anchor reloads. The door scenario checks forward/reverse passage, working About controls, and cleanup. The foundation scenario verifies automatic entry, sequential rises and reverse motion, fixed document position, viewport containment, boundary/Escape release, and all five descriptions in reading mode. The prompt and community controls are checked with keyboard input. The other spatial scenes are checked for scroll response and cleanup. Additional scenarios verify the Experience scroll budget and ecosystem arrow alignment.

The program tests check removal of diagrams and internal scroll regions, direct forward/reverse window changes with unchanged document position, overlapping navigation, content/footer containment, preserved program anchors, one/two/three filled header dots, and the restored “03” heading. The field test advances and reverses all five highlights within the third window, then returns to Labs without moving the document. It also checks forward boundary release and selection/counter synchronization across repeated motion-mode changes. Desktop profiles use native wheel input; mobile profiles use keyboard input. The scroll-budget test dispatches exactly 50.4px of normalized input (252px previously), observes all five field states in order, and confirms the document remains fixed. This avoids WebKit's native wheel rounding and unsupported mobile wheel API. A native-touch check through Chromium CDP traversed all Experience windows and field highlights with a single 60px swipe, then advanced four pillar rises with unchanged document position and verified release at both sequence ends. The accessibility audit includes the visible-label/accessible-name rule alongside WCAG A/AA checks.

## Responsive and visual review

The About proof block's top edge was verified against the About heading at 768px, 960px, 1024px, and 1440px widths. Mobile layouts were reviewed at 320px and 390px. A text-range check caught the proof figure extending into its padding at 320px; its smallest-screen font size was reduced. The field scrolling test uses 4px native wheel gestures with 125ms between checks; the pillar test uses 32px gestures with 180ms between checks. Both verify forward/reverse progression with the document locked.

The embedded field highlights and pavilion were visually reviewed in Chromium and WebKit at 1440 × 1000, 1024 × 768, 390 × 844, 375 × 667, 320 × 740, and 960 × 500. Both engines report no page errors or content/footer overflow at those sizes. The responsive audit checks reading layouts, all three active program windows, and the complete foundation scene at fourteen viewport sizes from 320px to 1920px wide. It checks text and footer containment, horizontal and vertical bounds, and absence of internal scrolling. Additional laptop measurements at 1200–1440px wide informed the compact-building height breakpoint. Mobile program navigation uses one row of three buttons. Field cells move horizontally into view without a separate user scroll region; reading mode exposes all cells in normal flow.

The physical door and rewritten notes were reviewed in Chromium and WebKit at 1440 × 1000, 390 × 844, 320 × 740, and 960 × 500, sampling the opening, passage, arrival, and reverse motion. The camera transitions to the real About section. Review corrected an entrance/fade conflict that initially hid the notes, a teardown issue that left neutral door transforms inline, and WebKit covering the door face with a redundant back panel. Perspective travels with the hinged panel, which stops just short of 90 degrees. The hero remains the only ScrollTrigger pin; Experience and the foundations use document locks.

The five pillars retain their meaning as the club's foundations. They rise as tall white columns with purple text; wide, tall screens show the descriptions on the columns, and smaller layouts show the active description beneath the building. Measurements immediately above the compact-layout breakpoint (861px tall, 1200–1440px wide) confirm the taller pavilion fits. Disabling motion exposes all five descriptions in normal flow. The roof's “The collective” label, standing-pillar counter, “Our common ground” band, and standalone field section are absent. The logo assets, organizational facts, and program anchor IDs remain intact. The new sketches are editorial illustrations, not photographs or claimed member projects. Production build, lint, and TypeScript checks pass.

The ecosystem's seven arrows connect WEC to Morrissette and each of the six destinations. Automated geometry checks across all five profiles verify that branch arrows point into their corresponding cards without overlapping labels and that cards stay within the viewport. Chromium and WebKit captures at 1440px, 1024px, 768px, 390px, and 320px widths report no page errors. Cards and arrows now animate as one group. `scripts/capture-ecosystem.mjs` saves the map under `artifacts/ecosystem-*`; set `SCENE_BROWSER=webkit` for WebKit.

Door screenshots are in ignored `artifacts/door-*.png` files. `scripts/capture-door.mjs` captures four viewport sizes at six positions; set `DOOR_BROWSER=webkit` to use WebKit. `scripts/capture-foundations.mjs` captures the integrated field window and the pavilion at six viewport sizes; set `SCENE_BROWSER=webkit` for WebKit. It writes screenshots and geometry reports under `artifacts/scenes-*`. `scripts/capture-motion.mjs` records the program windows, all field highlights, and the completed building. Earlier open-studio screenshots remain in `artifacts/studio-*.png`.

## Performance measurement

The initial local production Lighthouse audit, before subsequent hierarchy, scroll, spatial, and open-studio revisions, used default simulated mobile settings and reported:

| Category / metric | Result |
| --- | --- |
| Performance | 96 / 100 |
| Accessibility | 100 / 100 |
| Best practices | 100 / 100 |
| SEO | 100 / 100 |
| First contentful paint | 1.4 s |
| Largest contentful paint | 2.8 s |
| Total blocking time | 20 ms |
| Cumulative layout shift | 0.001 |

These are local lab measurements, not field data or a guarantee for every device and host. The audit report has no runtime error or run warnings. The Lighthouse CLI encountered a Windows temporary-profile cleanup error after saving the valid HTML and JSON reports. Subsequent changes added an explicit high-priority hero image request and improved accessible labels; the final browser and build checks were rerun afterward.

The app icon was reduced from 1,137,184 bytes to 33,831 bytes. Core wordmarks retain the original PNG pixels. Font binaries are local, lower-page marks load lazily, and the animation engine is split out of the initial render.

## Remaining configuration

Real membership and event destinations were not supplied. Their configured unavailable states are tested; live registration services cannot be verified until official URLs are provided. The public origin also needs to be set before deployment. No public deployment, real registration, or message to another person was performed.
