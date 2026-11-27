/*
 * "Keep scrolling to the next project": pure helpers. Once the page is scrolled to the bottom, further wheel,
 * touch-drag or keyboard input fills a progress bar; it drains when the input stops; full means "go to the next
 * work".
 */

/** Scroll distance (px) that fills the bar from empty. */
export const FILL_DISTANCE_PX = 900;
/** How fast the bar drains when idle (fraction per second). */
export const DRAIN_PER_S = 0.45;
/** Idle time (ms) before draining starts. */
export const DRAIN_DELAY_MS = 220;

const LINE_PX = 18;

/** Wheel delta in px whatever the deltaMode (0 pixel, 1 line, 2 page). */
export function normalizeWheel(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (!Number.isFinite(deltaY)) return 0;
  const unit = deltaMode === 1 ? LINE_PX : deltaMode === 2 ? pageHeight : 1;
  return Math.max(Math.min(deltaY * unit, 240), -240);
}

/** Adds a scroll distance (positive = towards the next work) to the progress, clamped to [0, 1]. */
export function accumulate(progress: number, px: number, distance = FILL_DISTANCE_PX): number {
  if (!Number.isFinite(px) || distance <= 0) return progress;
  return Math.min(Math.max(progress + px / distance, 0), 1);
}

export function drain(progress: number, dtS: number, rate = DRAIN_PER_S): number {
  return Math.max(0, progress - Math.max(dtS, 0) * rate);
}

export function isAtBottom(scrollY: number, viewportHeight: number, scrollHeight: number, tolerance = 2): boolean {
  return scrollY + viewportHeight >= scrollHeight - tolerance;
}

export function isComplete(progress: number): boolean {
  return progress >= 1;
}

export type Edge = 'top' | 'bottom' | 'both' | null;

/** Which end of the page the viewport is at ('both' when the page fits in the viewport). */
export function edgeOf(scrollY: number, viewportHeight: number, scrollHeight: number, tolerance = 2): Edge {
  const top = scrollY <= tolerance;
  const bottom = isAtBottom(scrollY, viewportHeight, scrollHeight, tolerance);
  return top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : null;
}

/** Time after arriving on a page during which edge input is ignored (trackpad momentum must not chain pages). */
export const ARRIVAL_COOLDOWN_MS = 700;
/** The viewport must have rested at the edge this long before input there counts. */
export const EDGE_SETTLE_MS = 150;

/** Whether input at an edge may fill a bar now. */
export function edgeReady(nowMs: number, arrivedAtMs: number, edgeSinceMs: number | null): boolean {
  if (edgeSinceMs === null) return false;
  return nowMs - arrivedAtMs >= ARRIVAL_COOLDOWN_MS && nowMs - edgeSinceMs >= EDGE_SETTLE_MS;
}

/** Direction a scroll intent points to at a given edge: down at the bottom → next, up at the top → prev. */
export function edgeIntent(edge: Edge, deltaPx: number): 'next' | 'prev' | null {
  if (deltaPx > 0 && (edge === 'bottom' || edge === 'both')) return 'next';
  if (deltaPx < 0 && (edge === 'top' || edge === 'both')) return 'prev';
  return null;
}
