import type { FragmentBounds, Vec3 } from './camera.ts';

/*
 * Film-fragment particles: small cut pieces of film stock, generated ONCE from a constant seed so ids, positions,
 * rotations and depth are identical on every render and every session. Never a full roll or a long strip.
 */

export const FRAGMENT_SEED = 0x7a31c9;
/** Only this many fragments (the first by id) get the slow CSS drift. */
export const MAX_DRIFT_FRAGMENTS = 8;

export type FragmentVariant = 'chip' | 'pair' | 'strip3';

export interface FilmFragmentSpec {
  id: string;
  variant: FragmentVariant;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  w: number;
  h: number;
  /** 0 = far, 1 = mid, 2 = near (by z tertile of the bounds). */
  depthLayer: 0 | 1 | 2;
  drift: boolean;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (value: number): number => Math.round(value * 100) / 100;
const between = (rnd: () => number, [min, max]: readonly [number, number]): number => min + (max - min) * rnd();

const VARIANTS: readonly FragmentVariant[] = ['chip', 'pair', 'strip3'];
const FRAMES: Readonly<Record<FragmentVariant, number>> = { chip: 1, pair: 2, strip3: 3 };

export interface FragmentClearance {
  /** Points to keep away from (the camera corridor and the works). */
  avoid: readonly Vec3[];
  /** Minimum distance to every avoid point. */
  radius: number;
}

const MAX_TRIES = 40;

export function generateFragments(
  count: number,
  bounds: FragmentBounds,
  seed: number = FRAGMENT_SEED,
  clearance?: FragmentClearance,
): FilmFragmentSpec[] {
  const rnd = mulberry32(seed);
  const [zMin, zMax] = bounds.z;
  const r2min = clearance ? clearance.radius ** 2 : 0;
  const clear = (x: number, y: number, z: number) =>
    !clearance || clearance.avoid.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 >= r2min);
  const out: FilmFragmentSpec[] = [];
  for (let i = 1; i <= count; i += 1) {
    // Draw order is fixed: changing it changes every fragment. Positions inside the camera's corridor (or on a
    // work) are redrawn from the same sequence, so the result stays deterministic.
    let x = between(rnd, bounds.x);
    let y = between(rnd, bounds.y);
    let z = between(rnd, bounds.z);
    for (let tries = 0; tries < MAX_TRIES && !clear(x, y, z); tries += 1) {
      x = between(rnd, bounds.x);
      y = between(rnd, bounds.y);
      z = between(rnd, bounds.z);
    }
    const rotX = between(rnd, [-35, 35]);
    const rotY = between(rnd, [-60, 60]);
    const rotZ = between(rnd, [-90, 90]);
    const variant = VARIANTS[Math.floor(rnd() * VARIANTS.length)];
    const frameW = between(rnd, [60, 96]);
    const third = (zMax - zMin) / 3;
    const depthLayer = (z < zMin + third ? 0 : z < zMin + 2 * third ? 1 : 2) as 0 | 1 | 2;
    out.push({
      id: `frag-${String(i).padStart(3, '0')}`,
      variant,
      x: r2(x),
      y: r2(y),
      z: r2(z),
      rotX: r2(rotX),
      rotY: r2(rotY),
      rotZ: r2(rotZ),
      w: r2(frameW * FRAMES[variant]),
      h: r2(frameW * 0.75),
      depthLayer,
      drift: i <= MAX_DRIFT_FRAGMENTS,
    });
  }
  return out;
}
