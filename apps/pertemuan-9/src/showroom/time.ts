/*
 * Time helpers shared by the showroom modules. Every time value in the showroom is in SECONDS (float).
 */

/** Wraps `x` into [0, cycleS). A non-positive cycle yields 0. */
export function wrapTime(x: number, cycleS: number): number {
  if (!(cycleS > 0)) return 0;
  const r = ((x % cycleS) + cycleS) % cycleS;
  // A tiny negative `x` can round the sum up to exactly `cycleS`.
  return r >= cycleS ? 0 : r;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
