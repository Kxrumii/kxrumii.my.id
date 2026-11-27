/*
 * Wheel/trackpad normalisation, extracted from the previous (spiral) gallery hook. Pure: no DOM types, so it runs under node.
 * Wheel input scrubs the timeline continuously; it is never "one wheel event = one project".
 */

export const DOM_DELTA_PIXEL = 0;
export const DOM_DELTA_LINE = 1;
export const DOM_DELTA_PAGE = 2;

export const LINE_PX = 18;
/** Cap for one event, so a wheel spike cannot throw the timeline across several works. */
export const MAX_WHEEL_DELTA_PX = 120;
/** [PLACEHOLDER] Timeline seconds scrubbed per normalised pixel (120 px -> 0.48 s). */
export const SCRUB_SECONDS_PER_PX = 0.004;

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}

const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);

/** Signed pixel delta (positive = scroll down/right = forward). Dominant axis, deltaMode-normalised, clamped. */
export function normalizeWheelDelta(event: WheelLike, pageHeightPx: number): number {
  const unit = event.deltaMode === DOM_DELTA_LINE ? LINE_PX : event.deltaMode === DOM_DELTA_PAGE ? finite(pageHeightPx, 800) : 1;
  const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  const px = finite(raw) * unit;
  return Math.max(Math.min(px, MAX_WHEEL_DELTA_PX), -MAX_WHEEL_DELTA_PX);
}

export function wheelToTimelineSeconds(deltaPx: number, secondsPerPx: number = SCRUB_SECONDS_PER_PX): number {
  return deltaPx * secondsPerPx;
}
