/*
 * Music track registry. Pure data + validation (no DOM), so it runs under node --test.
 *
 * Rights: the candidate tracks are owner-provided files kept LOCAL-ONLY in apps/pertemuan-7/local-media/ (excluded
 * from Git). Their URL is only set in development (`import.meta.env.DEV`), so a production build never references,
 * bundles or ships them. Production therefore has no track: Music ON falls back to the procedural ambient pad.
 *
 * Loop points are in seconds of the DECODED audio (what decodeAudioData/ffmpeg produce), and every loop is exactly
 * the camera cycle long (the camera schedule is authoritative; music is never time-stretched to fit it).
 * The values below are PROVISIONAL, taken from offline analysis (period/downbeat estimates), and still need the
 * owner's listening check before they can be called final.
 */

export type TrackId = 'on-sight' | 'shelter-piano';

export interface MusicTrackConfig {
  id: TrackId;
  title: string;
  /** Dev-only URL of the local file; null in production builds. */
  src: string | null;
  /** Decoded duration in seconds (for validation before the file is loaded). */
  durationS: number;
  loopInS: number | null;
  loopOutS: number | null;
  /** 0 = sample-accurate native loop; > 0 = scheduled equal-power crossfade centred on the loop boundary. */
  crossfadeMs: number;
  bpm?: number | null;
  timeSignature?: readonly [number, number] | null;
  /** Calibration: positive shows the visual earlier than the audio. */
  visualLeadMs: number;
  /** true while loop points are analysis-based guesses awaiting the owner's listening approval. */
  provisional: boolean;
}

const DEV = import.meta.env?.DEV === true;
const localMedia = (file: string): string | null => (DEV ? `${import.meta.env?.BASE_URL ?? '/'}local-media/${file}` : null);

export const TRACKS: Readonly<Record<TrackId, MusicTrackConfig>> = {
  'on-sight': {
    id: 'on-sight',
    title: 'On Sight (best part loop)',
    src: localMedia('on-sight.webm'),
    durationS: 166.022,
    // Waveform period measured at ~27.513 s (8 bars at ~69.8 BPM); loop starts on a downbeat estimate.
    loopInS: 8.185,
    loopOutS: 8.185 + 27.5,
    crossfadeMs: 30,
    bpm: 69.8,
    timeSignature: [4, 4],
    visualLeadMs: 0,
    provisional: true,
  },
  'shelter-piano': {
    id: 'shelter-piano',
    title: 'Shelter (Official Piano Version)',
    src: localMedia('shelter-piano.webm'),
    durationS: 202.141,
    // No natural 27.5 s period (free-tempo piano): best seam candidate by feature similarity, long crossfade.
    loopInS: 147.28,
    loopOutS: 147.28 + 27.5,
    crossfadeMs: 2000,
    bpm: null,
    timeSignature: null,
    visualLeadMs: 0,
    provisional: true,
  },
};

/**
 * Track used for testing; there is deliberately no track selector in the UI. In development only, QA can pick the
 * other candidate with localStorage `t7:dev-track` (read once at load).
 */
function devTrackOverride(): TrackId | null {
  if (!DEV) return null;
  try {
    const value = globalThis.localStorage?.getItem('t7:dev-track');
    return value === 'on-sight' || value === 'shelter-piano' ? value : null;
  } catch {
    return null;
  }
}

export const ACTIVE_TRACK_ID: TrackId = devTrackOverride() ?? 'on-sight';

/** One sample at 48 kHz: the tolerance for "the loop is exactly one camera cycle long". */
const SAMPLE_S = 1 / 48000;

export function validateTrack(track: MusicTrackConfig, cycleS: number): string[] {
  const errors: string[] = [];
  if (track.loopInS === null || track.loopOutS === null) return [`${track.id}: loop points are not set`];
  const { loopInS, loopOutS } = track;
  const xf = track.crossfadeMs / 1000;
  if (Math.abs(loopOutS - loopInS - cycleS) > SAMPLE_S) {
    errors.push(`${track.id}: loop length ${(loopOutS - loopInS).toFixed(6)} s must equal the camera cycle ${cycleS} s`);
  }
  if (!(track.crossfadeMs >= 0) || xf >= cycleS / 2) errors.push(`${track.id}: crossfade must be between 0 and half a cycle`);
  if (loopInS - xf / 2 < 0) errors.push(`${track.id}: loop-in needs ${xf / 2} s of audio before it for the crossfade`);
  if (loopOutS + xf / 2 > track.durationS) errors.push(`${track.id}: loop-out needs ${xf / 2} s of audio after it for the crossfade`);
  return errors;
}

/** File time (seconds of decoded audio) that plays at loop-timeline position `t`. */
export function fileTimeAt(track: MusicTrackConfig, timelineS: number): number {
  return (track.loopInS ?? 0) + timelineS;
}
