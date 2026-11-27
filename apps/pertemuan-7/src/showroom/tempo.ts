/*
 * Tempo of the camera schedule (owner decision 2026-11-27): every transition lasts 2 beats and every hold 6 beats,
 * so each work gets 8 beats (2 bars) and transitions start on the beat grid.
 *
 * The beat is derived from the measured waveform period of the On Sight loop (27.513 s = 32 beats, ~69.8 BPM).
 * That measurement is PROVISIONAL until the owner's listening check.
 *
 * Master timeline: the camera cycle (N works x 8 beats) and the music loop (32 beats) are both whole numbers of
 * beats, so the transport runs on their least common multiple. The camera wraps on its own cycle, the music on its
 * loop, and both stay on the same beat grid with clean seams.
 *
 * Development only: `?tune` / localStorage `t7:tune` can override beats, curve and distance for live tuning.
 */

export const LOOP_PERIOD_S = 27.513;
export const LOOP_BEATS = 32;
export const BEAT_S = LOOP_PERIOD_S / LOOP_BEATS;

export type Bezier = readonly [number, number, number, number];

export interface Tune {
  transitBeats: number;
  holdBeats: number;
  /** cubic-bezier control points of every camera transition. */
  bezier: Bezier;
  /** Multiplies the distances between works (1 = authored layout). */
  distanceScale: number;
}

/** Smooth start and end, quick middle, but not so steep that the move reads as a cut ("blink"). */
export const DEFAULT_TUNE: Tune = { transitBeats: 2, holdBeats: 6, bezier: [0.7, 0, 0.3, 1], distanceScale: 1 };

export const TUNE_STORAGE_KEY = 't7:tune';

function sanitize(raw: Partial<Tune> | null): Tune {
  const t = { ...DEFAULT_TUNE, ...(raw ?? {}) };
  const finite = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);
  const b = Array.isArray(t.bezier) && t.bezier.length === 4 ? t.bezier : DEFAULT_TUNE.bezier;
  return {
    transitBeats: Math.min(Math.max(Math.round(finite(t.transitBeats, 2)), 1), 8),
    holdBeats: Math.min(Math.max(Math.round(finite(t.holdBeats, 6)), 2), 24),
    bezier: [
      Math.min(Math.max(finite(b[0], 0.7), 0), 1),
      finite(b[1], 0),
      Math.min(Math.max(finite(b[2], 0.3), 0), 1),
      finite(b[3], 1),
    ],
    distanceScale: Math.min(Math.max(finite(t.distanceScale, 1), 0.6), 1.6),
  };
}

function devOverride(): Partial<Tune> | null {
  if (import.meta.env?.DEV !== true) return null;
  try {
    const value = globalThis.localStorage?.getItem(TUNE_STORAGE_KEY);
    return value ? (JSON.parse(value) as Partial<Tune>) : null;
  } catch {
    return null;
  }
}

export const TUNE: Tune = sanitize(devOverride());
export const TRANSIT_S = TUNE.transitBeats * BEAT_S;
export const HOLD_S = TUNE.holdBeats * BEAT_S;
export const TRANSIT_EASE: Bezier = TUNE.bezier;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Length of the master timeline: the least common multiple of the camera cycle and the music loop, when both are
 * whole numbers of beats; otherwise just the camera cycle (the music then cannot loop cleanly and is reported as
 * unavailable by track validation).
 */
export function masterCycleS(cameraCycleS: number): number {
  const beats = Math.round(cameraCycleS / BEAT_S);
  if (beats <= 0 || Math.abs(beats * BEAT_S - cameraCycleS) > 1e-6) return cameraCycleS;
  return ((beats * LOOP_BEATS) / gcd(beats, LOOP_BEATS)) * BEAT_S;
}

/**
 * The occurrence of camera-cycle time `targetS` closest to master time `t` (within half a camera cycle), so seeking
 * to a camera cue never jumps the music to another part of the master timeline.
 */
export function alignToPeriod(t: number, targetS: number, periodS: number, masterS: number): number {
  let candidate = Math.floor(t / periodS) * periodS + targetS;
  if (candidate - t > periodS / 2) candidate -= periodS;
  if (t - candidate > periodS / 2) candidate += periodS;
  return ((candidate % masterS) + masterS) % masterS;
}
