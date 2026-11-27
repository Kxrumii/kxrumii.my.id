import { wrapTime } from './time.ts';

/*
 * The ONE master timeline. The camera only ever reads transport.visualPosition(); nothing else keeps time.
 *
 * Units: every value is in SECONDS. A ClockSource supplies "now" in seconds on its own time base; the transport
 * keeps a single anchor pair (source time, timeline position) and derives positions from it, so there is no
 * accumulated delta-time and therefore no drift between camera and music by construction.
 *
 * Sources:
 *  - SilentClockSource: performance.now() / 1000 (the ms -> s conversion lives here and only here).
 *  - a music source (src/audio/musicSource.ts, M3): an adapter over the single AudioContext implementing this
 *    interface. It only provides time and start/stop of the audio node; it never computes timeline positions.
 */

export interface ClockSource {
  /** Current time of this source, in seconds. */
  now(): number;
  /**
   * Time of the audio currently being HEARD, in seconds on the same base as now() (now() minus output latency).
   * Omit for sources without audio latency.
   */
  audibleNow?(): number;
  /** Starts playback from `timelineOffsetS`; returns the source time at which that offset becomes audible-scheduled. */
  start?(timelineOffsetS: number): number;
  /** Stops playback (idempotent). */
  stop?(): void;
}

export function createSilentClock(nowMs: () => number = () => performance.now()): ClockSource {
  return { now: () => nowMs() / 1000 };
}

export interface TransportOptions {
  source: ClockSource;
  cycleS: number;
  /** Starting position on the timeline (default 0). */
  startS?: number;
  /**
   * Calibration. Positive = the visual leads the audio (visual shown earlier than the audible position).
   * Ignored while paused and for sources without audio.
   */
  visualLeadMs?: number;
}

export interface Transport {
  readonly cycleS: number;
  /** Scheduling position (what the transport "is at"), wrapped to [0, cycleS). */
  position(): number;
  /** Position to RENDER: audible position (latency-compensated) plus the visual lead, wrapped. */
  visualPosition(): number;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seek(timelineS: number): void;
  /** Swaps the clock source (audio on/off) without moving the timeline position. */
  setSource(next: ClockSource): void;
  setVisualLeadMs(ms: number): void;
}

export function createTransport(options: TransportOptions): Transport {
  const { cycleS } = options;
  let source = options.source;
  let leadMs = options.visualLeadMs ?? 0;
  let playing = false;
  let anchorTimelineS = wrapTime(options.startS ?? 0, cycleS);
  let anchorSourceS = source.now();

  const elapsedAt = (sourceTimeS: number): number =>
    playing ? anchorTimelineS + Math.max(0, sourceTimeS - anchorSourceS) : anchorTimelineS;

  const position = () => wrapTime(elapsedAt(source.now()), cycleS);

  const begin = () => {
    anchorSourceS = source.start ? source.start(anchorTimelineS) : source.now();
  };

  return {
    cycleS,
    position,
    visualPosition() {
      if (!playing) return wrapTime(anchorTimelineS, cycleS);
      // Sources without audio (silent clock) have nothing to line up with: no latency compensation, no lead.
      if (!source.audibleNow) return wrapTime(elapsedAt(source.now()), cycleS);
      return wrapTime(elapsedAt(source.audibleNow()) + leadMs / 1000, cycleS);
    },
    isPlaying: () => playing,
    play() {
      if (playing) return;
      playing = true;
      begin();
    },
    pause() {
      if (!playing) return;
      anchorTimelineS = position();
      source.stop?.();
      playing = false;
    },
    seek(timelineS) {
      if (playing) source.stop?.();
      anchorTimelineS = wrapTime(timelineS, cycleS);
      if (playing) begin();
      else anchorSourceS = source.now();
    },
    setSource(next) {
      const at = position();
      if (playing) source.stop?.();
      source = next;
      anchorTimelineS = at;
      if (playing) begin();
      else anchorSourceS = source.now();
    },
    setVisualLeadMs(ms) {
      leadMs = ms;
    },
  };
}
