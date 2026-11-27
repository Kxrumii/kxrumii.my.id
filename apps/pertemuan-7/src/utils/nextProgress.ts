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
