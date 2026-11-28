/** Ripple klik: ring pixel yang melebar dan memudar, bintang yang dilewatinya jadi lebih terang. */

export const RIPPLE_SPEED = 520; // px per detik
export const RIPPLE_LIFE_S = 1.3;
export const RIPPLE_BAND = 28; // px di kiri-kanan ring yang ikut menyala

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

/** Tambahan kecerahan (0–1) buat satu titik dari ripple yang lagi jalan. */
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
