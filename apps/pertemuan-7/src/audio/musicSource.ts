import type { ClockSource } from '../showroom/transport';
import { equalPowerCurve, planLoopSegments } from './loopSchedule';
import { getAudioGraph, getSnapshot, setMusicStatus, subscribe } from './soundEngine';
import { ACTIVE_TRACK_ID, TRACKS, loopLengthS, validateTrack, type MusicTrackConfig } from './tracks';

/*
 * Music source: an adapter that lets the showroom transport (the ONE master timeline) run on the soundtrack's
 * clock. It implements ClockSource over the engine's single AudioContext and only starts/stops audio nodes; it never
 * computes timeline positions itself.
 *
 *  - The active track is fetched and decoded once per session (decodeAudioData), then trimmed to the loop plus a
 *    small margin so the full decode (60-75 MB of float PCM) can be released.
 *  - Loop: crossfadeMs = 0 -> one node with sample-accurate loopStart/loopEnd; otherwise one node per cycle with an
 *    equal-power crossfade centred on each boundary. Every time comes from the AudioContext clock; the interval
 *    timer only decides how far ahead nodes are created.
 *  - Each play session goes through its own gain (short ramps on start/stop: no clicks), so stopping never has to
 *    cancel an in-progress crossfade curve.
 */

const LEAD_S = 0.06;
const ANTI_CLICK_S = 0.012;
const STOP_FADE_S = 0.025;
const LOOKAHEAD_S = 2;
const TICK_MS = 250;

interface LoadedTrack {
  track: MusicTrackConfig;
  buffer: AudioBuffer;
  /** File time (s) of the buffer's first sample. */
  sliceStartS: number;
}

export interface MusicClock extends ClockSource {
  readonly trackId: string;
  readonly visualLeadMs: number;
}

const cache = new Map<string, Promise<LoadedTrack>>();
const clocks = new Map<string, MusicClock>();

async function loadTrack(track: MusicTrackConfig, ctx: AudioContext): Promise<LoadedTrack> {
  if (!track.src || track.loopInS === null || track.loopOutS === null) throw new Error(`${track.id}: no playable source`);
  const response = await fetch(track.src);
  const type = response.headers.get('content-type') ?? '';
  // A missing local file comes back as the SPA's index.html in dev: treat that as "not available", not as audio.
  if (!response.ok || type.includes('text/html')) throw new Error(`${track.id}: source not found (${response.status} ${type})`);
  const full = await ctx.decodeAudioData(await response.arrayBuffer());
  const margin = track.crossfadeMs / 2000 + 0.05;
  const rate = full.sampleRate;
  const s0 = Math.max(0, Math.round((track.loopInS - margin) * rate));
  const s1 = Math.min(full.length, Math.round((track.loopOutS + margin) * rate));
  const buffer = ctx.createBuffer(full.numberOfChannels, s1 - s0, rate);
  for (let ch = 0; ch < full.numberOfChannels; ch += 1) buffer.copyToChannel(full.getChannelData(ch).subarray(s0, s1), ch);
  return { track, buffer, sliceStartS: s0 / rate };
}

function audibleTime(ctx: AudioContext): number {
  const stamp = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
  if (stamp && typeof stamp.contextTime === 'number' && typeof stamp.performanceTime === 'number' && stamp.contextTime > 0) {
    return Math.min(ctx.currentTime, stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000);
  }
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}

function createMusicClock(loaded: LoadedTrack, ctx: AudioContext, bus: GainNode): MusicClock {
  const { track, buffer, sliceStartS } = loaded;
  /** The music loops on its own period; the master transport position wraps into it. */
  const cycleS = loopLengthS(track);
  const xf = track.crossfadeMs / 1000;
  /** Buffer offset of loop-in. */
  const loopStart = (track.loopInS ?? 0) - sliceStartS;
  const curveIn = equalPowerCurve(64, 'in');
  const curveOut = equalPowerCurve(64, 'out');

  let session: { gain: GainNode; when: number; offset: number; next: number; timer: number; nodes: Set<AudioBufferSourceNode> } | null = null;

  function nodeFor(sessionGain: GainNode, nodes: Set<AudioBufferSourceNode>): { node: AudioBufferSourceNode; gain: GainNode } {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    const gain = ctx.createGain();
    node.connect(gain).connect(sessionGain);
    nodes.add(node);
    node.onended = () => {
      nodes.delete(node);
      node.disconnect();
      gain.disconnect();
    };
    return { node, gain };
  }

  function scheduleAhead(): void {
    const s = session;
    if (!s) return;
    const segments = planLoopSegments({ whenS: s.when, offsetS: s.offset, cycleS, crossfadeS: xf, untilS: ctx.currentTime + LOOKAHEAD_S, fromIndex: s.next });
    for (const seg of segments) {
      const { node, gain } = nodeFor(s.gain, s.nodes);
      if (seg.fadeIn) gain.gain.setValueCurveAtTime(curveIn, seg.fadeIn.from, seg.fadeIn.to - seg.fadeIn.from);
      gain.gain.setValueCurveAtTime(curveOut, seg.fadeOut.from, seg.fadeOut.to - seg.fadeOut.from);
      node.start(seg.startAt, Math.max(0, loopStart + seg.timelineOffset));
      node.stop(seg.stopAt);
      s.next = seg.index + 1;
    }
  }

  function stopSession(): void {
    const s = session;
    if (!s) return;
    session = null;
    window.clearInterval(s.timer);
    const now = ctx.currentTime;
    s.gain.gain.cancelScheduledValues(now);
    s.gain.gain.setValueAtTime(s.gain.gain.value, now);
    s.gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_S);
    for (const node of s.nodes) {
      try {
        node.stop(now + STOP_FADE_S + 0.01);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => s.gain.disconnect(), (STOP_FADE_S + 0.1) * 1000);
  }

  return {
    trackId: track.id,
    visualLeadMs: track.visualLeadMs,
    now: () => ctx.currentTime,
    audibleNow: () => audibleTime(ctx),
    stop: stopSession,
    start(masterOffsetS) {
      stopSession();
      const timelineOffsetS = ((masterOffsetS % cycleS) + cycleS) % cycleS;
      const when = ctx.currentTime + LEAD_S;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + ANTI_CLICK_S);
      gain.connect(bus);
      const nodes = new Set<AudioBufferSourceNode>();
      session = { gain, when, offset: timelineOffsetS, next: 0, timer: 0, nodes };
      if (xf === 0) {
        const { node } = nodeFor(gain, nodes);
        node.loop = true;
        node.loopStart = loopStart;
        node.loopEnd = loopStart + cycleS;
        node.start(when, loopStart + timelineOffsetS);
      } else {
        scheduleAhead();
        session.timer = window.setInterval(scheduleAhead, TICK_MS);
      }
      return when;
    },
  };
}

/**
 * Music clock for the active track at this camera cycle, or null when the build has no playable track (production),
 * the loop does not fit the cycle, or decoding failed. Reports the outcome through setMusicStatus.
 */
export async function ensureMusicClock(masterCycleS: number): Promise<MusicClock | null> {
  const track = TRACKS[ACTIVE_TRACK_ID];
  const graph = getAudioGraph();
  if (!track.src || validateTrack(track, masterCycleS).length > 0) {
    setMusicStatus('unavailable');
    return null;
  }
  if (!graph) return null;
  const key = track.id;
  const existing = clocks.get(key);
  if (existing) {
    setMusicStatus('ready');
    return existing;
  }
  let loading = cache.get(track.id);
  if (!loading) {
    loading = loadTrack(track, graph.ctx);
    cache.set(track.id, loading);
  }
  setMusicStatus('loading');
  try {
    const loaded = await loading;
    const clock = clocks.get(key) ?? createMusicClock(loaded, graph.ctx, graph.musicBus);
    clocks.set(key, clock);
    setMusicStatus('ready');
    return clock;
  } catch (error) {
    cache.delete(track.id);
    setMusicStatus('error');
    if (import.meta.env.DEV) console.warn('[t7 music]', error);
    return null;
  }
}

// A build without a playable track (production) reports "unavailable" as soon as Music is switched on, on any page,
// so the ambient pad takes the music layer's place without waiting for the gallery to mount.
subscribe(() => {
  const snap = getSnapshot();
  if (snap.musicEnabled && snap.musicStatus === 'loading' && !TRACKS[ACTIVE_TRACK_ID].src) setMusicStatus('unavailable');
});
