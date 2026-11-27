/*
 * Pure scheduling math for a crossfaded music loop (no Web Audio here, so it is unit-testable).
 *
 * The loop timeline position t maps to file time loopIn + t. Playback that starts at context time `whenS` from
 * timeline offset `offsetS` reaches the first loop boundary at whenS + (cycleS - offsetS), then every cycleS.
 * Around each boundary the outgoing segment fades out and the incoming one fades in over `crossfadeS`, centred on the
 * boundary, so both play the "same" moment of the loop (outgoing: loopOut +/- xf/2; incoming: loopIn +/- xf/2).
 * Times come from the AudioContext clock only; timers just decide how far ahead to schedule.
 */

export interface LoopSegment {
  index: number;
  /** Context time at which this segment's node starts. */
  startAt: number;
  /** Offset into the loop timeline at startAt (may be negative: material before loop-in, for the fade-in). */
  timelineOffset: number;
  /** Fade-in window (null for the very first segment, which only gets a short anti-click ramp). */
  fadeIn: { from: number; to: number } | null;
  fadeOut: { from: number; to: number };
  /** Context time at which the node is stopped (end of its fade-out). */
  stopAt: number;
}

export interface LoopPlanInput {
  whenS: number;
  offsetS: number;
  cycleS: number;
  crossfadeS: number;
  /** Schedule segments that start before this context time. */
  untilS: number;
  /** Continue numbering after already scheduled segments. */
  fromIndex?: number;
}

/** Context time of loop boundary k (k = 0 is the first boundary after playback starts). */
export function boundaryAt(whenS: number, offsetS: number, cycleS: number, k: number): number {
  return whenS + (cycleS - offsetS) + k * cycleS;
}

export function planLoopSegments({ whenS, offsetS, cycleS, crossfadeS, untilS, fromIndex = 0 }: LoopPlanInput): LoopSegment[] {
  const half = crossfadeS / 2;
  const out: LoopSegment[] = [];
  for (let index = fromIndex; ; index += 1) {
    const startAt = index === 0 ? whenS : boundaryAt(whenS, offsetS, cycleS, index - 1) - half;
    if (startAt >= untilS) break;
    const end = boundaryAt(whenS, offsetS, cycleS, index);
    out.push({
      index,
      startAt,
      timelineOffset: index === 0 ? offsetS : -half,
      fadeIn: index === 0 ? null : { from: startAt, to: startAt + crossfadeS },
      fadeOut: { from: Math.max(startAt, end - half), to: end + half },
      stopAt: end + half,
    });
  }
  return out;
}

/** Equal-power fade curve with `n` points (sin for in, cos for out); in^2 + out^2 = 1 at every point. */
export function equalPowerCurve(n: number, direction: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = n === 1 ? 1 : i / (n - 1);
    curve[i] = direction === 'in' ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2);
  }
  return curve;
}
