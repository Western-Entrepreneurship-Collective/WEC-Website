// Page movement and the locally controlled scenes have independent pacing.
export const PAGE_SCROLL_SLOWDOWN = 2;
export const EXPERIENCE_PACING = {
  // Scrolling each window holds before handing over, one entry per program.
  // Founder Labs asks the most of a reader, so it keeps the longest hold.
  program: { gesture: [480, 720], cooldown: 240, transition: .4 },
  field: { gesture: 240, cooldown: 120, transition: .18 },
};

export const PILLAR_GESTURE = 320;

// Keep the short garden approach; give the entrance and classroom room to breathe.
export const MORRISSETTE_ARRIVAL = .6;
export const MORRISSETTE_ENTRY_SLOWDOWN = 8.5;
export const MORRISSETTE_DOOR_END = .72;
export const MORRISSETTE_DOOR_SLOWDOWN = 6.4;
// The camera reaches its classroom pose at .94 and the view stops changing there.
// Running the remainder at page speed keeps the scene from holding several
// hundred pixels of scrolling on a still frame before the handoff releases it.
export const MORRISSETTE_SETTLED = .94;
export const MORRISSETTE_SETTLE_SLOWDOWN = 2;
const doorDistance = (MORRISSETTE_DOOR_END - MORRISSETTE_ARRIVAL) * MORRISSETTE_DOOR_SLOWDOWN;
const entryDistance = (MORRISSETTE_SETTLED - MORRISSETTE_DOOR_END) * MORRISSETTE_ENTRY_SLOWDOWN;
const settledStart = MORRISSETTE_ARRIVAL + doorDistance + entryDistance;
export const MORRISSETTE_SCROLL_SCALE = settledStart + (1 - MORRISSETTE_SETTLED) * MORRISSETTE_SETTLE_SLOWDOWN;
export function journeyProgress(scrollProgress: number) {
  const distance = scrollProgress * MORRISSETTE_SCROLL_SCALE;
  if (distance <= MORRISSETTE_ARRIVAL) return distance;
  if (distance <= MORRISSETTE_ARRIVAL + doorDistance) return MORRISSETTE_ARRIVAL + (distance - MORRISSETTE_ARRIVAL) / MORRISSETTE_DOOR_SLOWDOWN;
  if (distance <= settledStart) return MORRISSETTE_DOOR_END + (distance - MORRISSETTE_ARRIVAL - doorDistance) / MORRISSETTE_ENTRY_SLOWDOWN;
  return MORRISSETTE_SETTLED + (distance - settledStart) / MORRISSETTE_SETTLE_SLOWDOWN;
}
export function journeyScrollProgress(progress: number) {
  if (progress <= MORRISSETTE_ARRIVAL) return progress / MORRISSETTE_SCROLL_SCALE;
  if (progress <= MORRISSETTE_DOOR_END) return (MORRISSETTE_ARRIVAL + (progress - MORRISSETTE_ARRIVAL) * MORRISSETTE_DOOR_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
  if (progress <= MORRISSETTE_SETTLED) return (MORRISSETTE_ARRIVAL + doorDistance + (progress - MORRISSETTE_DOOR_END) * MORRISSETTE_ENTRY_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
  return (settledStart + (progress - MORRISSETTE_SETTLED) * MORRISSETTE_SETTLE_SLOWDOWN) / MORRISSETTE_SCROLL_SCALE;
}
