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
| `src/styles/ecosystem.css` | Aligned ecosystem cards and measured connections |
| `src/styles/mobile.css` | Phone spacing, typography, tap targets, and short-screen reading layouts |
| `src/components/sections/` | Eight sections, with all three programs inside Experience |
| `src/components/graphics/DraftGraphics.tsx` | Official logos and reusable drafting graphics |
| `src/components/graphics/StoryLayers.tsx` | Proof guides, field echoes, and final frame fragments |
| `src/components/graphics/StudioGraphics.tsx` | Original sketches, annotation marks, and interactive starting prompts |
| `src/components/graphics/StudioDoor.tsx` | Door frame, branded hinged panel, handle, and interior |
| `src/lib/motion/story.ts` | Scroll scenes, Venture Line, pinning, pointer response, and cleanup |
| `src/lib/motion/spatial.ts` | Scroll-driven doorway, proof, ecosystem, and invitation effects |
| `src/lib/motion/programScenes.ts` | Overlapping program windows and sequential field highlights |
| `src/lib/motion/foundationScene.ts` | Sequential column rises, foundation selection, and cleanup |
| `src/lib/motion/scrollSequence.ts` | Local gesture handling and document scroll locking |
| `src/lib/motion/preferences.ts` | Full-motion default and saved visitor opt-out |
| `public/brand/` | WEC artwork copied from the supplied kit |
| `public/images/` | Four original photographs supplied for the website |

The original WEC mark is an image, never retypeset. Font packages include their OFL licences. Artwork provenance and implementation decisions are documented in `docs/IMPLEMENTATION.md`.

## Motion and accessibility

The larger purple door carries the official logo and headline on its face. Scrolling opens it outward in front of the frame, enlarges the scene around the opening, and reveals the real About section underneath. Reverse scrolling closes it. The outside caption and posted notes are removed. About's reading column and proof poster share the same height on wider screens; small green accents continue throughout the page. The former Rooted in Western's band is removed.

Full motion is the default, including when the browser reports a reduced-motion system setting. The three overlapping Experience windows have no internal scrolling. Venture Studio and Founder Labs pair their copy with the supplied workspace and workshop photos. One document lock covers five positions: Studio, Labs, then Founders, Investors, and Alumni. Each Field perspective has two sentences beneath its name. Operators and Professionals are removed. Experience retains four times its previous scroll input: 72px between programs and 14.4px per highlight, with 480ms/240ms settling intervals and 800ms window transitions. Input during transitions is retained; 172.8px completes the sequence. All three headings include their number, and headers fill one, two, and three dots. The original program anchors open their windows directly. Elsewhere, wheel and touch travel half as far as before, using multipliers .85 and .75 and 1.3-second anchor transitions.

Community pairs the conversation photo with the supplied portrait of a presenter. Each gathering format expands its description immediately beneath its button and can be collapsed. The five principles support a fictional pavilion: a white roof, narrow white shafts, flared capitals and bases, and white steps frame centered purple copy. The former lavender bay backgrounds are removed. The document stays fixed during each 36px gesture, 200ms pause, and 360ms rise. Layouts at least 1200px wide and 960px tall put descriptions on the columns; smaller screens show the selected description below. The ecosystem uses eight aligned cards and eleven consistent connections, with no orbit lines or dotted background. Mobile uses two compact card columns with arrows routed around their outer edges.

Experience and foundation sequences release scrolling at their boundaries, on Escape, on outside focus, or through links. They run on screens at least 640px tall, or desktop layouts at least 960px wide and 500px tall. Shorter screens keep all programs and pillar descriptions in document flow while retaining decorative motion. Rotating a phone releases the lock and restores the appropriate layout. Mobile also uses larger tap targets, tighter section spacing, clearer Experience copy, a compact photo collage, and anchor offsets measured from the header. Narrow screens bring the active Field cell into view horizontally. The hero is the only ScrollTrigger pin, enabled on screens at least 600px tall or at least 960px wide and 500px tall. Its pin adds no extra document spacing. Shorter screens use normal flow. The footer's motion toggle restores a static door, exposes all Field and pillar descriptions, removes locks and pins, and saves the preference. All meaningful content is server rendered. The Morrissette ecosystem remains before Who WEC is for.

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
