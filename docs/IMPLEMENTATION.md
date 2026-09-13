# Implementation notes

## Identity audit

The website repository was empty. The supplied identity was located at `C:/Users/Seba/Desktop/WEC Design System`.

The audit included `SKILL.md`, `readme.md`, the original written brand kit, the Instagram creative-direction brief, all token files, logo guidance, drafting specimens, the UI kit, and all supplied raster artwork. `brand-audit.png` is the visual contact sheet used for review.

The identity retains Western Purple `#582C83`, Ivey Green `#034638` as an accent, Space Grotesk display type, and Inter body text. The approved expressive direction adds lavender and deep-purple surfaces, system handwriting for occasional annotations, monospace interface captions, and original SVG sketches. The supplied PNG geometry is unchanged. The four wordmark/lockup files were checked byte-for-byte against the original transparent assets. The app icon is a proportional 192px derivative for delivery; its original source remains in the supplied kit.

The supplied website UI kit explicitly describes itself as speculative and includes unverified dates, membership counts, testimonials, contact details, and partnership language. Those were excluded. This implementation uses the supplied organizational facts and an eight-section architecture, consolidating all three programs into Experience. It says WEC has strong ties to the Morrissette Institute and participates in the ecosystem, without asserting legal partnership, sponsorship, or endorsement.

The direct website brief and approval for a less corporate, more expressive design take precedence over earlier design-system recommendations against parallax, framing, rotation, handwritten notes, or illustration. These additions form an open-studio visual language. Original logo pixels remain unchanged; the complete branded door surface participates in the explicitly requested 3D opening motion. Four supplied photos now illustrate shared workspace, learning, and conversation. Remaining sketches are editorial illustrations, not claims about actual member projects.

[Filmbot](https://filmbot.com/) was reviewed for scale, pacing, whitespace, and scene-based presentation. No assets, copy, code, or exact compositions were reused.

## Narrative construction

1. **Hero:** the larger purple door carries the reversed official mark, organization name, and By Founders, for Founders headline. A separate trim surrounds the opening. The leaf starts 16px in front of it and swings outward to -108 degrees. Perspective travels on the leaf itself to preserve the effect in WebKit. The handle turns and the camera zooms through the opening to the real About section. Posted notes and the outside caption are removed.
2. **About:** the reading column and saturated $120K+ proof poster stretch to equal heights with aligned top edges on wider screens. They stack on mobile. The attribution remains adjacent, and a green-accented prompt selector offers three starting questions. The arrow and Rooted in Western's band are removed.
3. **Experience:** three overlapping windows contain Venture Studio, Founder Labs, and From-The-Field, with no internal scrolling. The first two pair program copy with supplied photographs. One document lock covers five positions: Studio, Labs, then Founders, Investors, and Alumni. Each perspective has two sentences beneath its name; Operators and Professionals are removed. Covered windows are removed from keyboard focus until active. Studio/Labs use 72px gestures and a 480ms pause; Field uses 14.4px and 240ms. These thresholds retain the requested fourfold slowdown. A retained-input queue renders each step even during a longer gesture; pending input clears at endpoints, navigation, and release. Fractional input tolerates native float32 rounding. Windows transition in 800ms, while narrow-screen Field positioning takes 560ms. Headings include 01, 02, and 03, with matching filled header dots. The original program anchors open their respective windows. There is no standalone Field section.
4. **Community:** the supplied conversation photo and a smaller overlapping portrait of a presenter replace the table illustration. The portrait preserves the supplied vertical framing. Five native accordion buttons reveal descriptions immediately beneath the selected format. Clicking an expanded format collapses it. These are program descriptions, not scheduled event listings.
5. **Five Pillars:** Build, Discover, Connect, Explore, and Contribute form a fictional pavilion. The roof, columns, and steps are white, with neutral molding details and purple copy. Transparent bays expose the section background; the lavender fill is removed. Narrow shafts have sloped shoulders and flared capitals and bases; all parts rise together. Numbers, names, and copy are centered and enlarged in purple. Capitals, fluted shafts, plinths, and steps continue the drafting theme. Each 36px gesture raises a column in 360ms, with a 200ms pause and fixed page position. Reverse scrolling lowers them. Layouts below 1200px wide or at most 959px tall show the selected description underneath; wider, taller screens place descriptions on the columns. Native buttons jump to a pillar. Leaving completes the building; disabling motion exposes every description. No roof label, standing counter, or common-ground band is shown.
6. **Ecosystem:** eight aligned cards form a balanced network around Morrissette, with eleven measured connections. Seven purple paths connect WEC, the hub, and the six opportunities; four green links connect adjacent opportunity cards. Uniform rounded cards, a plain paper surface, and consistent paths replace irregular shapes, orbit lines, and the dotted background. Desktop paths use centered cubic curves and vertical links. On phones, two card columns share outer connection rails, keeping all paths clear of labels. The mobile camera is 580px tall, down from 750px. A ResizeObserver recalculates paths from card edges, and the complete map retains its gentle scroll movement. The copy retains the supplied strong-ties wording.
7. **Audience:** selectable starting points reveal a concise explanation and a working anchor to the relevant experience.
8. **Join:** a welcoming badge and conversational invitation sit inside the assembling frame. The primary action has a tactile press response. Motion settles before the two configured actions.

The recurring Venture Line appears as frames, measurement guides, web connections, and the final composition. The proof's guides travel at different rates before aligning around the $120K+ figure. Experience windows arrive with perspective and a slight tilt, settle flat for reading, and recede behind the next. Field pairs each active cell with an oversized outline word drifting opposite the foreground guide. The requested slower pacing and document locks are preserved.

Pillar copy keeps its meaning as the club's foundational principles, gives all five equal importance, and preserves the original anchor IDs. The pavilion is a visual metaphor, not a physical WEC location. Large layouts use 88-126px ordinals; the compact description uses a 60-68px number, with readable 15-16px body copy and larger names. Short scenes tighten spacing to fit the complete interaction.

Section orientation uses descriptive h2 headings with a small green rule. Program names lead their compositions at display scale, with slogans beneath. Other sections pair a visible section name with a larger display paragraph, keeping the document outline descriptive. Reading mode puts all content in normal flow.

## Supplied photography

The originals were found in C:/Users/Seba/Desktop/website photos following the user's clarification. They are copied unmodified and served through Next Image with responsive sizes and CSS object positioning.

| Local asset | Original | Use |
| --- | --- | --- |
| public/images/venture-studio.jpg | 240910-schmeichel-building-drl-4688-1.jpg, 1245 x 830 | Venture Studio workspace |
| public/images/founder-labs.jpg | collaborators_space_low.jpg, 3471 x 2314 | Founder Labs workshop |
| public/images/community-conversation.png | Screenshot 2026-09-12 170040.png, 769 x 814 | Community group |
| public/images/community-speaker.jpg | ESI-26_DSC05575.jpg, 1368 x 2048 | Vertical Community portrait |

The first three images came from the website photos folder. The separate presenter portrait was subsequently supplied at C:/Users/Seba/Desktop/ESI-26_DSC05575.jpg and copied unmodified. Captions describe the programs and do not identify photographed people or claim these are WEC-hosted events.

## Engineering decisions

- Next.js App Router, TypeScript, and plain token-based CSS; no component-template dependency.
- The complete semantic page is prerendered. Interactive islands share a client shell; the animation module is dynamically imported only when motion is enabled.
- GSAP contexts and match-media contexts own the timelines. Reverting them removes pin wrappers and inline transforms. Event listeners, animation frames, observers, the GSAP ticker callback, and Lenis are explicitly cleaned up.
- The hero uses a pin without extra spacing, allowing About to scroll underneath it. The zoom pivot and final scale are measured from the door's layout coordinates and recalculated at responsive breakpoints. The aperture and surrounding wall become transparent as the frame passes outside the viewport. The hero releases pointer events before arrival, so controls in About remain usable. Door, camera, and foundation transforms are explicitly cleared during teardown. The headline and logo on the door remain accessible; only the decorative hardware, interior, and back face are hidden from assistive technology.
- Lenis smooths wheel input with a .85 multiplier and synchronizes touch input with a .75 multiplier, halving page travel for the same input. Both use .09 interpolation; anchor transitions take 1300ms. The page and Experience slowdown factors live in `src/lib/motion/pacing.ts`; the independent 2x and 4x factors do not compound. Experience (including From-The-Field) and the pavilion stop Lenis and lock document overflow while consuming input locally. Their thresholds operate on raw gestures, independent of the page multipliers. Automatic entry requires a recent scroll gesture, so anchor jumps and focus changes do not unexpectedly activate a sequence. Sequence boundaries, Escape, outside focus, links, and teardown restore page scrolling. Internal links retain URL hashes and move focus to the destination. Direct entry, browser navigation, and font-driven measurements are handled after layout refresh.
- Mobile uses larger touch controls, 14-15px Field copy, more compact photo layouts, and less section spacing. Sequences require a viewport at least 640px tall, or a desktop viewport at least 960px wide and 500px tall. Shorter layouts expose all program and pillar content in normal flow. A match-media teardown releases locks on orientation changes while retaining decorative motion. Internal anchor offsets follow the actual header height.
- Dialogs use native modal semantics with an explicit keyboard focus loop and focus restoration. Opening a dialog suspends Lenis.
- Full motion is the default, per the follow-up request. System settings and legacy saved preferences do not silently disable it; the footer provides a persistent manual opt-out. All meaningful content has a linear fallback. The door pins on screens at least 600px tall and on desktop layouts down to 500px tall. Smaller heights use normal flow. The static door remains visible when animations are disabled.
- There is no WebGL, custom cursor, invented photography, placeholder speaker, analytics service, form backend, or unsupported outbound destination.

## Before public deployment

Supply the real membership and event URLs, set the public origin, and rebuild. The website does not require a database. A Next.js-compatible host can run the production build. No public deployment was performed as part of the local implementation.
