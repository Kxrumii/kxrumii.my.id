/*
 * Pure schedule for looping a WHOLE song with a crossfade (no Web Audio here, so it is unit-tested).
 *
 * Segment 0 starts at context time `whenS` from song offset `offsetS` and runs to the end of the file. Every next
 * segment starts from the beginning of the file `crossfadeS` before the previous one ends: the outgoing tail fades
 * out over its last `crossfadeS` while the incoming head fades in. No loop points are guessed: the seam is simply
 * end → start. (Adapted from the crossfade scheduler in apps/pertemuan-9/src/audio/loopSchedule.ts.)
 */

export interface SongSegment {
  index: number;
  /** Context time at which the node starts. */
  startAt: number;
  /** Song offset (s) at startAt. */
  offset: number;
  /** Fade-in window; null for the first segment (it only gets a short anti-click ramp). */
  fadeIn: { from: number; to: number } | null;
  fadeOut: { from: number; to: number };
  /** Context time at which the file runs out (end of the fade-out). */
  endAt: number;
}

export interface SongLoopInput {
  whenS: number;
  offsetS: number;
  durationS: number;
  crossfadeS: number;
}

/** Period between consecutive segment starts once the loop is running. */
export function loopPeriod({ durationS, crossfadeS }: Pick<SongLoopInput, 'durationS' | 'crossfadeS'>): number {
  return durationS - crossfadeS;
}

export function segmentAt(input: SongLoopInput, index: number): SongSegment {
  const { whenS, offsetS, durationS, crossfadeS } = input;
  const firstEnd = whenS + (durationS - offsetS);
  const startAt = index === 0 ? whenS : firstEnd - crossfadeS + (index - 1) * loopPeriod(input);
  const offset = index === 0 ? offsetS : 0;
  const endAt = startAt + (durationS - offset);
  return {
    index,
    startAt,
    offset,
    fadeIn: index === 0 ? null : { from: startAt, to: startAt + crossfadeS },
    fadeOut: { from: endAt - crossfadeS, to: endAt },
    endAt,
  };
}

/** Segments with index >= fromIndex that start before `untilS`. */
export function planSongSegments(input: SongLoopInput, untilS: number, fromIndex = 0): SongSegment[] {
  if (!(input.durationS > input.crossfadeS * 2) || input.crossfadeS < 0) return [];
  const out: SongSegment[] = [];
  for (let index = fromIndex; ; index += 1) {
    const segment = segmentAt(input, index);
    if (segment.startAt >= untilS) break;
    out.push(segment);
  }
  return out;
}

/** Equal-power fade curve with `n` points (sin for in, cos for out); in² + out² = 1 at every point. */
export function equalPowerCurve(n: number, direction: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = n === 1 ? 1 : i / (n - 1);
    curve[i] = direction === 'in' ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2);
  }
  return curve;
}
