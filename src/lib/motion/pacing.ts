// Page movement and the locally controlled scenes have independent pacing.
export const PAGE_SCROLL_SLOWDOWN = 2;

// ─── What the held scenes cost a reader ──────────────────────────────────────
// Three scenes take the document's scrolling hostage and spend it themselves:
// the Experience windows with their field highlights, the pillars, and the
// Morrissette journey. Each is priced in the same unit — how much scrolling a
// reader has to spend before the scene hands the page back.
//
// SCENE_SPEEDUP divides that price. At 4 a scene asks for a quarter of the
// scrolling it asked for at 1.
//
// ⛔ IT DIVIDES THE ANIMATION DURATIONS TOO, AND THAT IS THE POINT. Each scene
// is choreography: a step's transition is already longer than the gap the
// cooldown allows between steps, so the poses chase the reader rather than
// finishing one at a time. Scaling the gesture without scaling the clock would
// not play the same scene faster, it would leave every pose stranded behind a
// reader who has already moved on. Dividing all three together plays exactly
// the scene that was designed, at four times the speed.
export const SCENE_SPEEDUP = 4;
const spend = (amount: number) => amount / SCENE_SPEEDUP;

// The journey gets its own figure. The two gesture scenes are counters: a step
// costs a number and the scene hands back whatever is left, so dividing that
// number is free. The journey is PINNED — it holds the document for exactly as
// many pixels as it is tall, and the camera, the doors and the six signs are
// spread across those pixels. Shortened as hard as the other two, the pin
// starts releasing the page while the camera is still moving.
//
// ⛔ MEASURED, NOT GUESSED. The entrance approach was run six times at each
// setting, counting how often the stage failed to hold the viewport through
// the door sequence:
//     1 → 0/6 failed      2 → 0/6 failed
//     3 → 2/6 failed      4 → roughly 1 in 5 failed
// 2 is therefore the most this scene takes while still holding every time.
// Raising it to match SCENE_SPEEDUP re-breaks the entrance; if that is ever
// wanted, the pin needs to stop being the thing that measures the journey.
export const MORRISSETTE_SPEEDUP = 2;
const journeySpend = (amount: number) => amount / MORRISSETTE_SPEEDUP;

export const EXPERIENCE_PACING = {
  // Scrolling each window holds before handing over, one entry per program.
  // Founder Labs asks the most of a reader, so it keeps the longest hold.
  program: { gesture: [spend(480), spend(720)], cooldown: spend(240), transition: spend(.4) },
  field: { gesture: spend(240), cooldown: spend(120), transition: spend(.18) },
};

export const PILLAR_GESTURE = spend(320);
export const PILLAR_COOLDOWN = spend(100 * PAGE_SCROLL_SLOWDOWN);
export const PILLAR_TRANSITION = spend(.18 * PAGE_SCROLL_SLOWDOWN);

// Keep the short garden approach; give the entrance and classroom room to breathe.
// Each leg is a slowdown: how much scrolling one unit of the journey's own
// progress costs. The garden used to run at page speed (1); it is divided like
// the rest so the whole journey shortens evenly rather than the approach
// swallowing what the speed-up saves everywhere else.
export const MORRISSETTE_ARRIVAL = .6;
export const MORRISSETTE_ARRIVAL_SLOWDOWN = journeySpend(1);
export const MORRISSETTE_ENTRY_SLOWDOWN = journeySpend(8.5);
export const MORRISSETTE_DOOR_END = .72;
export const MORRISSETTE_DOOR_SLOWDOWN = journeySpend(6.4);
// The camera reaches its classroom pose at .94 and the view stops changing there.
// Running the remainder at page speed keeps the scene from holding several
// hundred pixels of scrolling on a still frame before the handoff releases it.
export const MORRISSETTE_SETTLED = .94;
export const MORRISSETTE_SETTLE_SLOWDOWN = journeySpend(2);
const arrivalDistance = MORRISSETTE_ARRIVAL * MORRISSETTE_ARRIVAL_SLOWDOWN;
const doorDistance = (MORRISSETTE_DOOR_END - MORRISSETTE_ARRIVAL) * MORRISSETTE_DOOR_SLOWDOWN;
const entryDistance = (MORRISSETTE_SETTLED - MORRISSETTE_DOOR_END) * MORRISSETTE_ENTRY_SLOWDOWN;
const settledStart = arrivalDistance + doorDistance + entryDistance;
export const MORRISSETTE_SCROLL_SCALE = settledStart + (1 - MORRISSETTE_SETTLED) * MORRISSETTE_SETTLE_SLOWDOWN;
export function journeyProgress(scrollProgress: number) {
  const distance = scrollProgress * MORRISSETTE_SCROLL_SCALE;
  if (distance <= arrivalDistance) return distance / MORRISSETTE_ARRIVAL_SLOWDOWN;
  if (distance <= arrivalDistance + doorDistance) return MORRISSETTE_ARRIVAL + (distance - arrivalDistance) / MORRISSETTE_DOOR_SLOWDOWN;
  if (distance <= settledStart) return MORRISSETTE_DOOR_END + (distance - arrivalDistance - doorDistance) / MORRISSETTE_ENTRY_SLOWDOWN;
  return MORRISSETTE_SETTLED + (distance - settledStart) / MORRISSETTE_SETTLE_SLOWDOWN;
}
export function journeyScrollProgress(progress: number) {
  if (progress <= MORRISSETTE_ARRIVAL) return progress * MORRISSETTE_ARRIVAL_SLOWDOWN / MORRISSETTE_SCROLL_SCALE;
  if (progress <= MORRISSETTE_DOOR_END) return (arrivalDistance + (progress - MORRISSETTE_ARRIVAL) * MORRISSETTE_DOOR_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
  if (progress <= MORRISSETTE_SETTLED) return (arrivalDistance + doorDistance + (progress - MORRISSETTE_DOOR_END) * MORRISSETTE_ENTRY_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
  return (settledStart + (progress - MORRISSETTE_SETTLED) * MORRISSETTE_SETTLE_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
}
