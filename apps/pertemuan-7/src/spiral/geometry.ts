/*
 * Pure geometry of the spiral (CSS 3D helix, no WebGL). No DOM access, so it is unit-tested directly.
 *
 * The spiral is a vertical helix of "slots". Slot i sits at offset d = i - p from the camera position p
 * (in slots): it turns `STEP_DEG` per slot around the vertical axis and drops `rise` px per slot, so the
 * front of the helix is the active work and the rest coil away above and below it, front and back.
 *
 * Short lists are repeated around the helix (slot i shows work i mod n) so the coil always looks full;
 * the work order itself is never changed.
 */

/** Rotation between consecutive slots: 360 / 30 = 12 slots per full turn. */
export const STEP_DEG = 30;
/** Minimum number of slots once the list loops (one full turn). */
export const MIN_SLOTS = 12;
/** Fewer works than this never loop: they stay in a short arc in front of the camera. */
export const LOOP_MIN_WORKS = 3;

export interface SpiralGeometry {
  /** Helix radius in px. */
  radius: number;
  /** Vertical drop per slot in px. */
  rise: number;
}

export interface CardPose {
  transform: string;
  opacity: number;
  /** cos(angle): 1 = facing the camera, -1 = at the back of the helix. */
  facing: number;
  /** Whether this card may receive pointer input (front half, clearly visible). */
  interactive: boolean;
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function loops(workCount: number): boolean {
  return workCount >= LOOP_MIN_WORKS;
}

/** Number of slots on the helix for `workCount` works (a whole number of repetitions). */
export function slotCount(workCount: number): number {
  if (workCount <= 0) return 0;
  if (!loops(workCount)) return workCount;
  return Math.max(workCount, Math.ceil(MIN_SLOTS / workCount) * workCount);
}

/** Which work a slot shows. */
export function workIndexForSlot(slot: number, workCount: number): number {
  if (workCount <= 0) return -1;
  return ((Math.round(slot) % workCount) + workCount) % workCount;
}

/** Offset of a slot from position p, wrapped into [-slots/2, slots/2) when the helix loops. */
export function slotOffset(slot: number, p: number, slots: number, looping: boolean): number {
  let d = slot - finite(p);
  if (looping && slots > 0) {
    const half = slots / 2;
    d = ((((d + half) % slots) + slots) % slots) - half;
  }
  return finite(d);
}

/** The slot nearest to the camera position. */
export function activeSlot(p: number, slots: number): number {
  if (slots <= 0) return -1;
  return ((Math.round(finite(p)) % slots) + slots) % slots;
}

/** Index of the active work at position p. */
export function activeWorkIndex(p: number, workCount: number): number {
  return workIndexForSlot(activeSlot(p, slotCount(workCount)), workCount);
}

/** Pose of one slot. */
export function cardPose(slot: number, p: number, slots: number, looping: boolean, geometry: SpiralGeometry): CardPose {
  const d = slotOffset(slot, p, slots, looping);
  const angle = d * STEP_DEG;
  const y = d * geometry.rise;
  const facing = Math.cos((angle * Math.PI) / 180);
  // Fade towards the ends of the coil (and across the loop seam, so the wrap jump is never visible).
  const reach = looping ? slots / 2 : Math.max(slots, 2);
  const endFade = clamp01((reach - Math.abs(d)) / 2.5);
  // The back of the helix stays visible but recedes.
  const depthFade = 0.38 + 0.62 * clamp01((facing + 0.35) / 1.35);
  const opacity = finite(endFade * depthFade, 0);
  return {
    transform: `translate3d(-50%, -50%, 0) translate3d(0, ${y.toFixed(2)}px, 0) rotateY(${angle.toFixed(3)}deg) translateZ(${finite(geometry.radius).toFixed(2)}px)`,
    opacity: Number(opacity.toFixed(3)),
    facing,
    interactive: facing > 0.35 && opacity > 0.5,
  };
}

/** Shortest target position that shows `workIndex`, measured from p. */
export function nearestPositionFor(workIndex: number, p: number, workCount: number): number {
  const slots = slotCount(workCount);
  if (slots <= 0) return 0;
  if (!loops(workCount)) return Math.min(Math.max(Math.round(workIndex), 0), workCount - 1);
  const current = Math.round(finite(p));
  let best = current;
  let bestDistance = Infinity;
  // Every slot showing this work is a candidate; take the one closest to p.
  for (let base = current - slots; base <= current + slots; base += 1) {
    if (workIndexForSlot(base, workCount) !== workIndex) continue;
    const distance = Math.abs(base - p);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = base;
    }
  }
  return best;
}
