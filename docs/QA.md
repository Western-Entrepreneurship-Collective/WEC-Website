# Verification record

Verified locally on Windows on 2026-09-12.

## Automated checks

| Check | Result |
| --- | --- |
| ESLint | Passed, no errors or warnings |
| TypeScript | Passed |
| Production build | Passed; homepage statically prerendered |
| Playwright | 82 passed across five profiles; three desktop-only skips for the phone rotation scenario |
| Axe | No detected violations in the configured WCAG A/AA and accessible-label checks |
| Asset provenance | Four supplied logo PNGs and all four added photographs match their source files byte-for-byte |
| Dependency audit at installation | No reported vulnerabilities |

Browser profiles: desktop Chromium, Firefox, and WebKit at 1440 × 1000; Chromium and WebKit mobile emulation at 390 × 844. WebKit testing is browser-engine coverage, not a claim that physical Safari/iPhone devices were tested.

The sixteen shared scenarios cover section order, internal anchors, image availability, page overflow, audience selection, dialogs, keyboard focus, motion preferences and cleanup, and direct-anchor reloads. The door scenario checks forward/reverse passage, working About controls, and cleanup. The foundation scenario verifies automatic entry, sequential rises and reverse motion, fixed document position, viewport containment, boundary/Escape release, and all five descriptions in reading mode. The prompt and community controls are checked with keyboard input. The other spatial scenes are checked for scroll response and cleanup. Additional scenarios verify the Experience scroll budget and ecosystem arrow alignment.

The program tests check the absence of diagrams and internal scroll regions, forward/reverse window changes with unchanged document position, overlapping navigation, content/footer containment, preserved anchors, one/two/three filled header dots, and all program numbers. Field advances and reverses through Founders, Investors, and Alumni inside the third window, then returns to Labs without moving the document. Tests also check boundary release and selection/counter synchronization across repeated motion-mode changes. Each remaining perspective has two sentences beneath its name.

The Experience budget test confirms that 43.2px stays on Studio and 172.8px total completes all five sequence positions, four times the previous per-step input. It observes all three Field states in order while the document stays fixed. The latest native-touch check through Chromium CDP confirms that 60px stays on Studio, 120px cumulative reaches Labs, and 180px completes all Field highlights with no page movement; the next swipe releases scrolling. Native wheel checks in Chromium, Firefox, and WebKit measure 85px page travel for 100px input, compared with 170px previously. The independent global and Experience slowdown factors remain intact.

Community tests confirm keyboard operation, expanded-state announcements, descriptions immediately adjacent to the selected button, and collapse on a second click. The accessibility audit includes visible-label/accessible-name and WCAG A/AA checks. The full suite passes, including the additional phone rotation scenario in both mobile engines. That scenario verifies that rotation releases the document lock, exposes all programs and pillar descriptions, and restores animated navigation in portrait.

The subsequent portrait and pillar-shape revision passed production build, lint, and all 15 relevant asset, foundation-motion, and accessibility scenarios across the five profiles. Chromium and WebKit visual checks confirm the narrower shafts and flared capitals/bases fit desktop and mobile layouts, including 1200 x 960 and 320 x 740. The supplied presenter photo loads correctly and matches its source file.

## Responsive and visual review

The mobile refinement audit passed all sixteen Chromium/WebKit combinations at 320 x 568, 320 x 740, 360 x 640, 375 x 667, 390 x 844, 430 x 932, 740 x 360, and 844 x 390. It checks program and footer containment, absence of internal program scrolling, pavilion fit, ecosystem labels, and 44px minimum dimensions for the primary navigation, pillar buttons, and program footer controls. Short screens switch to normal document flow. Run scripts/mobile-audit.mjs against port 3000; results are saved in artifacts/mobile-audit.json.

The aligned About columns have equal top positions and heights in the desktop/tablet captures at 1440px, 1024px, and 960px. They stack on mobile. Minor green accents appear in section rules, the starting prompt, photo details, and ecosystem paths. The former About arrow and Rooted in Western's band are absent.

The larger door, with its logo and headline attached to the face, was captured in Chromium and WebKit at 1440 x 1000, 390 x 844, 320 x 740, and 960 x 500. Captures sample opening, passage, arrival, and reverse motion. The leaf projects in front of the frame and rotates outward to -108 degrees; carrying perspective on the leaf fixes WebKit's flattened appearance. Notes and the outside caption are removed. The camera reaches the real About section, and disabling motion clears the transforms. Only decorative door components are hidden from assistive technology.

The two program photos, Community collage, and ecosystem web were reviewed at 1440 x 1000, 1024 x 768, 390 x 844, 375 x 667, 320 x 740, and 960 x 500. Final WebKit captures report no page errors, program-body overflow, footer overflow, or image/footer overlap. All four images match the supplied originals byte-for-byte. The vertical Community frame now uses the separately supplied presenter portrait.

The final Chromium responsive audit passed all fourteen viewport sizes from 320px to 1920px wide. It checks reading-mode text bounds, each active program window, content/footer containment, absence of internal scroll, and the complete foundation scene. The review caught and fixed Field footer crowding at 375 x 812 and 1366 x 650. The audit waits for the full 800ms window transition before measuring. Narrow-screen Field cells move horizontally as selection changes; reading mode exposes all three in normal flow.

The pavilion has a white roof, shafts, flared capitals/bases, and steps, with purple text. Lavender bay backgrounds are removed. Large layouts show descriptions on the columns; widths below 1200px or heights at most 959px use the selected description beneath the building. The complete pavilion fits the audited viewports, including 960 x 500 and 1920 x 1080. Disabling motion exposes all descriptions. No roof label, standing count, or common-ground band is shown.

The refined ecosystem has eight aligned cards and eleven connections. Automated checks across all five browser/device profiles verify endpoints, the visible WEC-to-hub arrow, card bounds, and absence of card overlap. Sampled points along every path also stay clear of unrelated cards. A ResizeObserver keeps paths attached during responsive changes. The dotted background, orbit lines, irregular shapes, and hub ornament are removed.

Visual artifacts are ignored by Git. scripts/capture-door.mjs captures six door positions at four sizes; DOOR_BROWSER=webkit selects WebKit. scripts/capture-foundations.mjs captures Field and the pavilion at six sizes. scripts/capture-editorial.mjs captures About, Community, Ecosystem, and all three program windows, recording geometry and page errors. SCENE_BROWSER=webkit selects WebKit for these scene captures. scripts/capture-motion.mjs records each program and Field state. Screenshots and reports are under artifacts/.

## Performance measurement

The initial local production Lighthouse audit, before subsequent hierarchy, scroll, spatial, open-studio, and photography revisions, used default simulated mobile settings and reported:

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
