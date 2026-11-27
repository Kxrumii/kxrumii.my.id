import { validateSchedule, MIN_HOLD_S, type Schedule } from './timeline.ts';
import { wrapTime } from './time.ts';

/*
 * Music Cue Map: manual, authoritative cue timestamps for a specific audio loop. There is no beat detection.
 *
 * Timestamps are ABSOLUTE seconds from the start of the audio file. They are normalised to the loop timeline with
 *   timelineS = (transitionStartS - loopInS) mod cycleS,   cycleS = loopOutS - loopInS
 * BPM / time signature / bar / beat are supporting metadata only and never replace the timestamps.
 *
 * No real map exists yet: the track, loop points and cues are pending an owner-provided, legally usable asset.
 * Nothing here may be filled with guessed values.
 */

export interface MusicCueEntry {
  id: string;
  /** Id of the camera cue (ShowroomCue.id) this entry starts a transition for. */
  cameraCueId: string;
  /** Absolute seconds from the start of the audio file. */
  transitionStartS: number;
  bar?: number;
  beat?: number;
  note?: string;
}

export interface MusicCueMap {
  trackId: string;
  source: { kind: 'local-untracked' | 'licensed-url'; ref: string };
  loopInS: number;
  loopOutS: number;
  bpm?: number | null;
  timeSignature?: readonly [number, number] | null;
  calibration: {
    /** Positive = the visual leads the audio. */
    visualLeadMs: number;
  };
  cues: readonly MusicCueEntry[];
}

/** The camera side of the pairing: cue ids in curated order and the fixed duration of each outgoing segment. */
export interface CameraCueTiming {
  id: string;
  durationS: number;
}

export type ScheduleResult = { ok: true; schedule: Schedule } | { ok: false; errors: string[] };

export function cueMapToSchedule(
  map: MusicCueMap,
  cameraCues: readonly CameraCueTiming[],
  minHoldS: number = MIN_HOLD_S,
): ScheduleResult {
  const errors: string[] = [];
  const cycleS = map.loopOutS - map.loopInS;
  if (!Number.isFinite(cycleS) || !(cycleS > 0)) errors.push('loopOutS must be greater than loopInS');
  if (map.loopInS < 0) errors.push('loopInS must not be negative');

  const byCameraCue = new Map(map.cues.map((c) => [c.cameraCueId, c]));
  if (byCameraCue.size !== map.cues.length) errors.push('each camera cue may have only one music cue');
  const cameraIds = new Set(cameraCues.map((c) => c.id));
  for (const entry of map.cues) {
    if (!cameraIds.has(entry.cameraCueId)) errors.push(`music cue ${entry.id}: unknown camera cue ${entry.cameraCueId}`);
  }
  for (const cue of cameraCues) {
    if (!byCameraCue.has(cue.id)) errors.push(`camera cue ${cue.id} has no music cue`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const starts: number[] = [];
  for (const cue of cameraCues) {
    const entry = byCameraCue.get(cue.id)!;
    if (!(entry.transitionStartS >= map.loopInS && entry.transitionStartS < map.loopOutS)) {
      errors.push(`music cue ${entry.id}: ${entry.transitionStartS}s is outside the loop [${map.loopInS}, ${map.loopOutS})`);
    }
    starts.push(wrapTime(entry.transitionStartS - map.loopInS, cycleS));
  }
  if (errors.length > 0) return { ok: false, errors };

  const schedule: Schedule = { cycleS, transitionStartS: starts };
  const scheduleErrors = validateSchedule(
    cameraCues.map((c) => c.durationS),
    schedule,
    minHoldS,
  );
  return scheduleErrors.length > 0 ? { ok: false, errors: scheduleErrors } : { ok: true, schedule };
}
