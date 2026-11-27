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
/** Helix radius and vertical step relative to the card size. RISE > 1 keeps every card clear of its neighbours. */
export const RADIUS_PER_WIDTH = 1.25;
export const RISE_PER_HEIGHT = 1.2;

/*
 * Scene camera, written to the DOM by useSpiral (single source: projectCard() below uses the same numbers).
 * The scene origin sits at the perspective origin, so projection is a plain perspective divide around it.
 */
export const PERSPECTIVE_PX = 1500;
export const ORIGIN_Y = 0.46;
export const TILT_X_DEG = -7;
export const TILT_Z_DEG = -4;

/** Cards turned further than this from the camera are hidden (only the front of the coil is visible). */
const FACING_HIDE = 0.45;
const FACING_FULL = 0.75;

export function sceneTransform(radius: number): string {
  return `translateZ(${(-radius).toFixed(2)}px) rotateX(${TILT_X_DEG}deg) rotateZ(${TILT_Z_DEG}deg)`;
}

/** Radius and rise for a card size. */
export function geometryFor(cardWidth: number, cardHeight: number): SpiralGeometry {
  return { radius: cardWidth * RADIUS_PER_WIDTH, rise: cardHeight * RISE_PER_HEIGHT };
}

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
  /** Signed offset from the camera position in slots (used to stagger enter/exit). */
  offset: number;
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
  // Only the front of the helix is visible: cards fade out as they turn side-on.
  const depthFade = clamp01((facing - FACING_HIDE) / (FACING_FULL - FACING_HIDE));
  const opacity = finite(endFade * depthFade, 0);
  return {
    transform: `translate3d(-50%, -50%, 0) translate3d(0, ${y.toFixed(2)}px, 0) rotateY(${angle.toFixed(3)}deg) translateZ(${finite(geometry.radius).toFixed(2)}px)`,
    opacity: Number(opacity.toFixed(3)),
    facing,
    interactive: facing > 0.35 && opacity > 0.5,
    offset: d,
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

export interface Viewport {
  width: number;
  height: number;
}

export type Point = readonly [number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Screen-space corners of a slot's card, following exactly the CSS chain: card `translate(0, y) rotateY(a)
 * translateZ(R)` about its centre, scene `translateZ(-R) rotateX(TILT_X) rotateZ(TILT_Z)`, then perspective
 * PERSPECTIVE_PX around (50%, ORIGIN_Y). Returns null when a corner falls behind the camera.
 */
export function projectCard(
  slot: number,
  p: number,
  slots: number,
  looping: boolean,
  geometry: SpiralGeometry,
  card: { width: number; height: number },
  viewport: Viewport,
): Point[] | null {
  const d = slotOffset(slot, p, slots, looping);
  const a = rad(d * STEP_DEG);
  const cx = rad(TILT_X_DEG);
  const cz = rad(TILT_Z_DEG);
  const ox = viewport.width / 2;
  const oy = viewport.height * ORIGIN_Y;
  const corners: Point[] = [];
  for (const [qx, qy] of [
    [-card.width / 2, -card.height / 2],
    [card.width / 2, -card.height / 2],
    [card.width / 2, card.height / 2],
    [-card.width / 2, card.height / 2],
  ] as const) {
    // Card: rotateY(a) of (qx, qy, R), then translate y.
    let x = qx * Math.cos(a) + geometry.radius * Math.sin(a);
    let y = qy + d * geometry.rise;
    let z = -qx * Math.sin(a) + geometry.radius * Math.cos(a);
    // Scene: rotateZ, then rotateX, then translateZ(-R) (CSS applies the right-most function first).
    [x, y] = [x * Math.cos(cz) - y * Math.sin(cz), x * Math.sin(cz) + y * Math.cos(cz)];
    [y, z] = [y * Math.cos(cx) - z * Math.sin(cx), y * Math.sin(cx) + z * Math.cos(cx)];
    z -= geometry.radius;
    if (z >= PERSPECTIVE_PX - 1) return null;
    const scale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);
    corners.push([ox + x * scale, oy + y * scale]);
  }
  return corners;
}

/** Separating-axis test for two convex polygons (true = they overlap with positive area). */
export function polygonsOverlap(a: readonly Point[], b: readonly Point[], epsilon = 0.5): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      const length = Math.hypot(nx, ny) || 1;
      const project = (pts: readonly Point[]) => pts.map(([x, y]) => (x * nx + y * ny) / length);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) + epsilon || Math.max(...pb) <= Math.min(...pa) + epsilon) return false;
    }
  }
  return true;
}
