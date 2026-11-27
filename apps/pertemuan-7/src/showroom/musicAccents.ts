import { loopLengthS, type MusicTrackConfig } from '../audio/tracks.ts';
import { masterCycleS } from './tempo.ts';
import type { CameraScheduleEntry } from './timeline.ts';
import { wrapTime } from './time.ts';

/*
 * Music Accent Map: hand-picked musical accents of one track, DOCUMENTED against the fixed camera schedule.
 * It never changes the schedule (owner decision): there is no beat detection, no time-stretching, and not every beat
 * is a cue. An accent may name the camera cue it is meant to coincide with; accentAlignment() only reports how far
 * apart they are, so a mismatch is visible but never "fixed" by moving the camera.
 *
 * Accent times are seconds of the DECODED audio file, like the track's loop points.
 */

export type AccentKind = 'downbeat' | 'hit' | 'drop' | 'phrase';

export interface MusicAccent {
  id: string;
  timeS: number;
  kind: AccentKind;
  /** Camera cue whose transition start this accent is meant to coincide with, if any. */
  cameraCueId?: string;
}

export interface MusicAccentMap {
  trackId: string;
  accents: readonly MusicAccent[];
}

/** Accents chosen by the owner after listening; empty until then. */
export const ACCENT_MAPS: readonly MusicAccentMap[] = [
  { trackId: 'on-sight', accents: [] },
  { trackId: 'shelter-piano', accents: [] },
];

export interface AccentAlignment {
  accentId: string;
  cameraCueId: string;
  /** Where the accent falls on the loop timeline. */
  accentTimelineS: number;
  transitionStartS: number;
  /**
   * Signed offset to the nearest start of that transition over the whole master timeline (the music loop and the
   * camera cycle have different lengths, so the accent meets the cue at several places): positive = after.
   */
  offsetMs: number;
}

export function validateAccentMap(map: MusicAccentMap, track: MusicTrackConfig, schedule: readonly CameraScheduleEntry[]): string[] {
  const errors: string[] = [];
  if (map.trackId !== track.id) errors.push(`accent map is for ${map.trackId}, not ${track.id}`);
  if (track.loopInS === null || track.loopOutS === null) return [...errors, `${track.id}: loop points are not set`];
  const cueIds = new Set(schedule.map((entry) => entry.cueId));
  const ids = new Set<string>();
  for (const accent of map.accents) {
    if (ids.has(accent.id)) errors.push(`accent ${accent.id}: duplicate id`);
    ids.add(accent.id);
    if (!(accent.timeS >= track.loopInS && accent.timeS < track.loopOutS)) {
      errors.push(`accent ${accent.id}: ${accent.timeS} s is outside the loop [${track.loopInS}, ${track.loopOutS})`);
    }
    if (accent.cameraCueId !== undefined && !cueIds.has(accent.cameraCueId)) {
      errors.push(`accent ${accent.id}: unknown camera cue ${accent.cameraCueId}`);
    }
  }
  return errors;
}

/** Report only: how far each paired accent is from its camera transition start. The schedule is not touched. */
export function accentAlignment(
  map: MusicAccentMap,
  track: MusicTrackConfig,
  schedule: readonly CameraScheduleEntry[],
  cameraCycleS: number,
): AccentAlignment[] {
  if (track.loopInS === null) return [];
  const loopIn = track.loopInS;
  const loopS = loopLengthS(track);
  const master = masterCycleS(cameraCycleS);
  const loops = Math.max(1, Math.round(master / loopS));
  const periods = Math.max(1, Math.round(master / cameraCycleS));
  const byCue = new Map(schedule.map((entry) => [entry.cueId, entry]));
  return map.accents.flatMap((accent) => {
    const entry = accent.cameraCueId ? byCue.get(accent.cameraCueId) : undefined;
    if (!entry) return [];
    const accentTimelineS = wrapTime(accent.timeS - loopIn, loopS);
    let best = Infinity;
    for (let j = 0; j < loops; j += 1) {
      for (let i = 0; i < periods; i += 1) {
        let diff = wrapTime(accentTimelineS + j * loopS - (entry.transitionStartS + i * cameraCycleS), master);
        if (diff > master / 2) diff -= master;
        if (Math.abs(diff) < Math.abs(best)) best = diff;
      }
    }
    return [{ accentId: accent.id, cameraCueId: entry.cueId, accentTimelineS, transitionStartS: entry.transitionStartS, offsetMs: Math.round(best * 1000) }];
  });
}
