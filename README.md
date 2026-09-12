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
| `src/styles/door.css` | Physical door, posted notes, and responsive hero layout |
| `src/styles/scenes.css` | Embedded field highlights and the responsive five-column pavilion |
| `src/components/sections/` | Eight sections, with all three programs inside Experience |
| `src/components/graphics/DraftGraphics.tsx` | Official logos and reusable drafting graphics |
| `src/components/graphics/StoryLayers.tsx` | Proof guides, field echoes, and final frame fragments |
| `src/components/graphics/StudioGraphics.tsx` | Original sketches, annotation marks, and interactive starting prompts |
| `src/components/graphics/StudioDoor.tsx` | Door frame, hinged panel, handle, interior, and two invitation notes |
| `src/lib/motion/story.ts` | Scroll scenes, Venture Line, pinning, pointer response, and cleanup |
| `src/lib/motion/spatial.ts` | Scroll-driven doorway, proof, ecosystem, and invitation effects |
| `src/lib/motion/programScenes.ts` | Overlapping program windows and sequential field highlights |
| `src/lib/motion/foundationScene.ts` | Sequential column rises, foundation selection, and cleanup |
| `src/lib/motion/scrollSequence.ts` | Local gesture handling and document scroll locking |
| `src/lib/motion/preferences.ts` | Full-motion default and saved visitor opt-out |
| `public/brand/` | WEC artwork copied from the supplied kit |

The original WEC mark is an image, never retypeset. Font packages include their OFL licences. Artwork provenance and implementation decisions are documented in `docs/IMPLEMENTATION.md`.

## Motion and accessibility

The hero contains a purple door with a hinged panel and handle. Scrolling opens the door, enlarges the scene around the opening, and reveals the actual About section underneath. The motion reverses when scrolling back. Two posted notes invite visitors to bring unfinished ideas and find people to build with. The remaining story uses animated proof guides, program-window depth, field highlights, a drawing community poster, a rising five-column pavilion, an arrowed ecosystem map, and an assembling invitation frame.

Full motion is the default, including when the browser reports a reduced-motion system setting. The three overlapping WEC Experience windows present each program in plain text. Venture Studio and Founder Labs diagrams have been removed. Windows have no internal scrolling: wheel, touch, and keyboard input advance directly between programs while the document stays at the same position. Experience needs one fifth of its previous scroll input: 18px between programs and 3.6px per field highlight, with 120ms/60ms settling intervals. Input received during transitions is retained. The five From-The-Field perspectives live inside the third window, whose heading includes “03”; the three window headers fill one, two, and three dots respectively. There is no separate From-The-Field section. Program buttons and the original program URL anchors open the corresponding window directly. Elsewhere, wheel input travels 1.7 times farther and touch input 1.5 times farther, with quicker smoothing and anchor transitions.

The five principles support a fictional pavilion with a drawn roof, capitals, tall white fluted columns, purple text, and steps. Scroll input raises the columns sequentially using an 18px threshold, 100ms pause, and 180ms rise while the document stays fixed. Wide, tall screens show the descriptions on the columns; smaller screens show the selected description beneath the building. The roof's “The collective” label, standing-pillar counter, and “Our common ground” band have been removed. Both the Experience and foundation sequences release scrolling at their boundaries, on Escape, on outside focus, or through navigation links. The ecosystem map uses a WEC → Morrissette arrow and six arrowed branches; its cards and connections move together to preserve alignment.

These sequences work on desktop and mobile. Narrow screens bring the active From-The-Field cell into view horizontally. The hero is the only ScrollTrigger pin: on screens at least 600px tall, or at least 960px wide and 500px tall. Its pin adds no extra document spacing, so About approaches behind the doorway as the reader enters. Shorter screens use a flowing scene. Turning motion off restores the static door, exposes all five pillar descriptions, removes locks and pins, and saves the preference. Starting prompts and community-format controls use native buttons and announce updated content. All content is rendered on the server. The Morrissette ecosystem appears before “Who WEC is for.”

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

The Playwright suite runs against production on port 3001 and covers five browser/device profiles. It checks narrative order, links, assets, audience interactions, dialogs, focus, reduced motion, anchor restoration, scroll-responsive depth, and animation cleanup. Axe audits run on the complete reduced-motion page.

Additional visual checks are in `scripts/`. `responsive-audit.mjs` expects production on port 3001; the capture scripts expect development on port 3000. They save screenshots to ignored `artifacts/`. See `docs/QA.md` for the verified results and practical limits.
