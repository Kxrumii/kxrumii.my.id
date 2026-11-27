import { equalPowerCurve, planSongSegments, type SongLoopInput } from './loopPlan';

/*
 * Background music: "Shelter (Official Piano Version)", looped whole with a 2 s crossfade.
 *
 * Rights: the file is the owner's and is NEVER committed. Development reads it from apps/pertemuan-7/local-media/
 * (excluded from Git); production plays `<base>/media/shelter.webm` only if the owner has put that file on the
 * server by hand. A missing file (404, or the SPA's index.html served instead) means "unavailable": the app stays
 * silent apart from the interface sounds.
 *
 * Fetch/decode and the node-per-segment crossfade are adapted from the earlier Task 7 showroom (branch archive/pertemuan-9-showroom).
 * All times come from the AudioContext clock; the interval only decides how far ahead nodes are created. Pausing
 * is free: when sound is off the context is suspended, which freezes its clock and with it the whole schedule.
 */

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

const FILE = 'shelter.webm';
const CROSSFADE_S = 2;
const LEAD_S = 0.08;
const ANTI_CLICK_S = 0.012;
const LOOKAHEAD_S = 3;
const TICK_MS = 400;

export function musicUrl(): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return import.meta.env?.DEV ? `${base}local-media/${FILE}` : `${base}media/${FILE}`;
}

async function loadBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(musicUrl());
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || type.includes('text/html')) throw new Error(`music unavailable (${response.status} ${type})`);
  return ctx.decodeAudioData(await response.arrayBuffer());
}

let started = false;

/**
 * Loads the track once and starts the endless crossfaded loop into `bus`. Calls `onStatus` with the outcome.
 * Safe to call repeatedly; only the first call does anything.
 */
export function startMusic(ctx: AudioContext, bus: AudioNode, onStatus: (status: MusicStatus) => void): void {
  if (started) return;
  started = true;
  onStatus('loading');
  loadBuffer(ctx)
    .then((buffer) => {
      const input: SongLoopInput = { whenS: ctx.currentTime + LEAD_S, offsetS: 0, durationS: buffer.duration, crossfadeS: CROSSFADE_S };
      const curveIn = equalPowerCurve(64, 'in');
      const curveOut = equalPowerCurve(64, 'out');
      let next = 0;
      const schedule = () => {
        for (const segment of planSongSegments(input, ctx.currentTime + LOOKAHEAD_S, next)) {
          const node = ctx.createBufferSource();
          node.buffer = buffer;
          const gain = ctx.createGain();
          if (segment.fadeIn) {
            gain.gain.setValueCurveAtTime(curveIn, segment.fadeIn.from, segment.fadeIn.to - segment.fadeIn.from);
          } else {
            gain.gain.setValueAtTime(0, segment.startAt);
            gain.gain.linearRampToValueAtTime(1, segment.startAt + ANTI_CLICK_S);
          }
          gain.gain.setValueCurveAtTime(curveOut, segment.fadeOut.from, segment.fadeOut.to - segment.fadeOut.from);
          node.connect(gain).connect(bus);
          node.onended = () => {
            node.disconnect();
            gain.disconnect();
          };
          node.start(segment.startAt, segment.offset);
          node.stop(segment.endAt);
          next = segment.index + 1;
        }
      };
      schedule();
      window.setInterval(schedule, TICK_MS);
      onStatus('playing');
    })
    .catch((error: unknown) => {
      if (import.meta.env?.DEV) console.warn('[t7 music]', error);
      onStatus('unavailable');
    });
}
