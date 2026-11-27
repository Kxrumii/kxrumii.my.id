/** Click ripples: a pixel ring that expands and fades, brightening the stars it passes. Pure helpers. */

export const RIPPLE_SPEED = 520; // px per second
export const RIPPLE_LIFE_S = 1.3;
export const RIPPLE_BAND = 28; // px either side of the ring that light up

export interface Ripple {
  x: number;
  y: number;
  bornS: number;
}

export function rippleRadius(ripple: Ripple, nowS: number): number {
  return Math.max(0, nowS - ripple.bornS) * RIPPLE_SPEED;
}

export function rippleAlpha(ripple: Ripple, nowS: number): number {
  const t = (nowS - ripple.bornS) / RIPPLE_LIFE_S;
  return t < 0 || t >= 1 ? 0 : (1 - t) * (1 - t);
}

/** Extra brightness (0–1) a point receives from the live ripples. */
export function rippleBoost(ripples: readonly Ripple[], x: number, y: number, nowS: number): number {
  let boost = 0;
  for (const ripple of ripples) {
    const alpha = rippleAlpha(ripple, nowS);
    if (alpha === 0) continue;
    const off = Math.abs(Math.hypot(x - ripple.x, y - ripple.y) - rippleRadius(ripple, nowS));
    if (off < RIPPLE_BAND) boost = Math.max(boost, alpha * (1 - off / RIPPLE_BAND));
  }
  return boost;
}

export function liveRipples(ripples: readonly Ripple[], nowS: number): Ripple[] {
  return ripples.filter((ripple) => nowS - ripple.bornS < RIPPLE_LIFE_S);
}
