# WEC — The Builder’s Draft

A complete editorial website for Western Entrepreneurship Collective, built with Next.js, React, TypeScript, GSAP ScrollTrigger, and Lenis. Its open-studio direction combines purple and lavender compositions, original working sketches, interactive invitations, and a shared foundation for the club's five pillars.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

```sh
npm run build
npm run start
```

The homepage is statically prerendered. Fonts, logos, and graphic assets are served locally; there are no runtime Google Fonts, stock-image, or third-party animation requests.

## Connect official destinations

Copy `.env.example` to `.env.local` and supply verified destinations:

```dotenv
NEXT_PUBLIC_WEC_JOIN_URL=
NEXT_PUBLIC_WEC_EVENTS_URL=
NEXT_PUBLIC_SITE_URL=
```

The membership and event fields accept HTTPS URLs. Set `NEXT_PUBLIC_SITE_URL` to the public origin before deployment so canonical and social-image URLs use the correct host. Restart development or rebuild production after changing these build-time variables.

Until official destinations are configured, the calls to action open accessible dialogs explaining that details are not yet available. They do not collect personal information or claim to submit an application or RSVP. No contact address, social account, event date, or partnership claim was taken from the speculative UI kit.

## Edit the site

| Location | Purpose |
| --- | --- |
| `src/data/siteContent.ts` | Editorial copy, programs, pillars, audiences, and destination configuration |
| `src/styles/tokens.css` | Brand colours, typography, spacing, and shared dimensions |
| `src/styles/globals.css` | Editorial compositions, mobile layouts, and linear fallbacks |
| `src/styles/spatial.css` | Decorative depth layers and responsive perspective |
| `src/styles/studio.css` | Open-studio art direction, foundation structure, posters, and responsive compositions |
| `src/styles/door.css` | Branded physical door and responsive hero layout |
| `src/styles/scenes.css` | Embedded field highlights and the responsive five-column pavilion |
| `src/styles/editorial.css` | Photography, green accents, aligned About columns, and inline gathering descriptions |
| `src/styles/ecosystem.css` | Morrissette model presentation, entrance signs, and classroom controls |
| `src/styles/mobile.css` | Phone spacing, typography, tap targets, and short-screen reading layouts |
| `src/components/sections/` | Eight sections, with all three programs inside Experience |
| `src/components/graphics/DraftGraphics.tsx` | Official logos and reusable drafting graphics |
| `src/components/graphics/StoryLayers.tsx` | Proof guides, field echoes, and final frame fragments |
| `src/components/graphics/StudioGraphics.tsx` | Original sketches, annotation marks, and interactive starting prompts |
| `src/components/graphics/StudioDoor.tsx` | Door frame, branded hinged panel, handle, and interior |
| `src/lib/motion/story.ts` | Scroll scenes, Venture Line, pinning, pointer response, and cleanup |
| `src/lib/three/campus.ts` | Procedural campus, winding path, classroom, seated people, and camera / picking |
| `src/lib/motion/spatial.ts` | Scroll-driven doorway, proof, ecosystem, and invitation effects |
| `src/lib/motion/programScenes.ts` | Overlapping program windows and sequential field highlights |
| `src/lib/motion/foundationScene.ts` | Sequential column rises, foundation selection, and cleanup |
| `src/lib/motion/scrollSequence.ts` | Local gesture handling and document scroll locking |
| `src/lib/motion/preferences.ts` | Full-motion default and saved visitor opt-out |
| `public/brand/` | WEC artwork copied from the supplied kit |
| `public/images/` | Supplied photographs for the programs, community, and doorway collage |

The original WEC mark is an image, never retypeset. Font packages include their OFL licences. Artwork provenance and implementation decisions are documented in `docs/IMPLEMENTATION.md`.

## Motion and accessibility

The larger purple door carries the official logo and headline on its face. Scrolling opens it outward to reveal six supplied photos tiled without borders or gaps around “You’re in good company.” The collage stays visible during entry before fading to the real About section underneath. Reverse scrolling closes the door. The outside caption and posted notes are removed. About's reading column and proof poster share the same height on wider screens; small green accents continue throughout the page. The former Rooted in Western's band is removed.

Full motion is the default, including when the browser reports a reduced-motion system setting. The three overlapping Experience windows have no internal scrolling. Venture Studio and Founder Labs pair their copy with the supplied workspace and workshop photos. One document lock covers five positions: Studio, Labs, then Founders, Investors, and Alumni. Each Field perspective has two sentences beneath its name. Operators and Professionals are removed. Experience uses 320px between programs and 240px per highlight, with 240ms/120ms settling intervals and 400ms window transitions. Field positioning takes 180ms. Input during transitions is retained; 1120px completes the sequence. Partial gestures accumulate across pauses up to 1.5 seconds; reversing cancels queued movement immediately. Keyboard arrows and direct navigation remain one-step controls. All three headings include their number, and headers fill one, two, and three dots. The original program anchors open their windows directly. Elsewhere, wheel and touch travel half as far as before, using multipliers .85 and .75 and 1.3-second anchor transitions.

Community pairs the conversation photo with the supplied portrait of a presenter. Each gathering format expands its description immediately beneath its button and can be collapsed. The five principles support a fictional pavilion: a white roof, narrow white shafts, flared capitals and bases, and white steps frame centered purple copy. The former lavender bay backgrounds are removed. The roof and steps fade in with the first pillar and fade out when it is lowered. The document stays fixed during each 320px gesture, 200ms pause, and 360ms rise. Layouts at least 1200px wide and 960px tall put descriptions on the columns; smaller screens show the selected description below. The ecosystem reinterprets the supplied autumn-campus illustration as an original Three.js environment: stepped off-white buildings, layered sage-grey glass, softly varied green foliage, a winding garden path, soft clouds, and a planted arrival court. The classroom carries the same palette through an oak table, forest-green chairs, a pale sage rug, tall windows with muted foliage, neutral writing boards, and green cabinetry. The section background and controls share the site’s white, purple, and deep green palette. Scrolling follows the approach; six cream-white, hand-lettered arrow signs on wooden posts sprout from the ground during the approach, pointing inward toward the entrance. The approach retains its short scroll distance. From arrival at 60% of the visual sequence, the front-door pause uses 6.4 times the original scroll distance; after 72%, entry and the classroom handoff use eight times the original distance. The final view pulls back slightly to keep the six choices and refreshed “Every starting point. A seat at the table.” copy together on screen, with the introduction in the bottom left. Exterior geometry does not cast shadows into the classroom, so daylight remains consistent during entry and at the handoff. The scene stays opaque and fills the viewport beneath the navigation throughout the transition, with matching camera framing at the handoff. Six modeled people sit on chairs around an oval table. Each person can be selected directly. Full starting-point statements float above the people as keyboard-accessible buttons linked to the existing guidance. Their type is 2.5× larger, with wider cards and light connector lines. Labels and connector lines fade in with scrolling between 92% and 98% of the approach and fade out on reversal. The lower-left introduction begins appearing during the classroom approach. The building name and subtitle share one raised plaque with correctly proportioned lettering. Motion-off mode shows the entrance and all signs; short screens use normal flow. The renderer loads near the section, draws only when needed, and supplies local still images if WebGL is unavailable.

Experience and foundation sequences release scrolling at their boundaries, on Escape, on outside focus, or through links. Reversing near an exit re-enters at the correct end; reversing out of the pillars leaves the building empty. Consumed gestures do not also move the page. Navigation can be interrupted by wheel, touch, or keyboard input, and the mobile menu pauses background scrolling. They run on screens at least 640px tall, or desktop layouts at least 960px wide and 500px tall. Shorter screens keep all programs and pillar descriptions in document flow while retaining decorative motion. Rotating a phone releases the lock and restores the appropriate layout. Mobile also uses larger tap targets, tighter section spacing, clearer Experience copy, a compact photo collage, and anchor offsets measured from the header. Narrow screens bring the active Field cell into view horizontally. The hero uses a ScrollTrigger pin on screens at least 600px tall or at least 960px wide and 500px tall. The ecosystem journey also pins on screens at least 640px tall. Both pins use their existing scene height without adding spacer padding. Shorter screens use normal flow. The footer's motion toggle restores a static door, exposes all Field and pillar descriptions, removes locks and pins, and saves the preference. All meaningful content is server rendered. The Morrissette ecosystem remains before Who WEC is for.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

The Playwright suite runs against production on port 3001 and covers five browser/device profiles. It checks narrative order, links, assets, audience interactions, dialogs, focus, reduced motion, anchor restoration, scroll-responsive depth, and animation cleanup. Axe audits run on the complete reduced-motion page.

Additional visual checks are in `scripts/`. `responsive-audit.mjs` expects production on port 3001; the capture scripts and mobile-audit.mjs expect development on port 3000. They save screenshots to ignored `artifacts/`. See `docs/QA.md` for the verified results and practical limits.
