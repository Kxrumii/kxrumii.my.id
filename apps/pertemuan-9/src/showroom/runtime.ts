import { createSilentClock, createTransport, type ClockSource, type Transport } from './transport.ts';

/*
 * The shared master transport lives at module level so the timeline position survives view switches
 * (Gallery <-> List), the work sheet and route changes: there is exactly one timeline, owned by nobody's component.
 *
 * Its clock source is either the silent clock (Music OFF, no playable track, decoding, or audio failed) or the music
 * clock (Music ON with a ready track). Switching goes through transport.setSource(), which re-anchors at the current
 * position: the camera never jumps and the music starts exactly where the camera is.
 */
let shared: Transport | null = null;
const silent = createSilentClock();
let music: ClockSource | null = null;
let musicLeadMs = 0;

let seated = false;

/** True once the timeline has been placed on a hold for the first time this session (later mounts keep the position). */
export function takeFirstSeat(): boolean {
  const first = !seated;
  seated = true;
  return first;
}

export function sharedTransport(cycleS: number): Transport {
  if (!shared || shared.cycleS !== cycleS) {
    shared?.pause();
    shared = createTransport({ source: music ?? silent, cycleS, visualLeadMs: music ? musicLeadMs : 0 });
  }
  return shared;
}

/** Selects the clock: a music clock, or null for the silent clock. Keeps the timeline position. */
export function setMusicClock(next: ClockSource | null, visualLeadMs = 0): void {
  if (music === next) return;
  music = next;
  musicLeadMs = next ? visualLeadMs : 0;
  if (!shared) return;
  shared.setSource(next ?? silent);
  shared.setVisualLeadMs(musicLeadMs);
}

export function activeClock(): 'music' | 'silent' {
  return music ? 'music' : 'silent';
}
