/*
 * Sound engine: ONE AudioContext for everything (music, SFX, ambient). Web Audio API only.
 *
 * Graph:   music source(s) -> musicBus ─┐
 *          SFX voices      -> sfxBus   ─┼─> master -> compressor -> destination
 *          ambient pad     -> ambientBus┘
 *
 * Two independent switches, persisted separately:
 *  - Music: the soundtrack (musicBus). With no playable track it is the procedural ambient pad instead.
 *  - SFX:   every interface and showroom effect (sfxBus), including radio-off/on and the tape scrub.
 * Turning one on or off never changes the other. Neither switch touches the camera: Music OFF only makes the
 * showroom transport fall back to its silent clock (see showroom/runtime.ts).
 *
 * - The context is created lazily, only from a user gesture (gate or a toggle): autoplay-policy safe.
 * - Hidden tab: master silenced and the context suspended; restored on return.
 * - With both switches off the context is suspended so it costs no CPU.
 */
export type SoundName = 'hover' | 'tick' | 'click' | 'switch' | 'open' | 'close' | 'radio-off' | 'radio-on' | 'seek' | 'arrival';

/** off: Music switched off; loading: decoding the track; ready: track playable; unavailable: no track in this build; error: decode failed. */
export type MusicStatus = 'off' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface SoundSnapshot {
  supported: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicStatus: MusicStatus;
  /** A video is playing: music and ambience are ducked. */
  ducked: boolean;
}

const KEY_MUSIC = 't9:music';
const KEY_SFX = 't9:sfx';
const KEY_LEGACY = 't9:sound';
const MASTER_LEVEL = 0.9;
const AMBIENT_LEVEL = 0.3;
const SCRUB_DUCK_LEVEL = 0.15;
const HOVER_THROTTLE_MS = 60;

const AudioContextCtor: typeof AudioContext | null =
  typeof window !== 'undefined' && 'AudioContext' in window ? window.AudioContext : null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastHoverAt = 0;
let suspendTimer = 0;
/** Controller-driven music shaping (independent of the Music switch). */
let musicScrubDucked = false;
let musicMuted = false;
/** Development counters for scripted QA. */
const counters = { contexts: 0, sfxVoices: 0 };
/**
 * Last bus targets set by applyLevels (dev inspection). AudioParam.value is not a reliable read-out here: an idle
 * bus is not rendered, so its value stays frozen even though its automation is scheduled correctly.
 */
let targets = { master: 0, sfx: 0, music: 0, ambient: 0 };

function readStored(key: string): boolean | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'on' ? true : value === 'off' ? false : null;
  } catch {
    return null;
  }
}

function store(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    /* storage disabled: the choice simply isn't remembered */
  }
}

let snapshot: SoundSnapshot = {
  supported: AudioContextCtor !== null,
  musicEnabled: false,
  sfxEnabled: false,
  musicStatus: 'off',
  ducked: false,
};
const listeners = new Set<() => void>();

function emit(next: Partial<SoundSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): SoundSnapshot {
  return snapshot;
}

/**
 * Last choice on this device, used to pre-select the gate button: 'on' if either switch was on.
 * Falls back to the single switch of earlier versions (t9:sound).
 */
export function getStoredPreference(): 'on' | 'off' | null {
  const music = readStored(KEY_MUSIC);
  const sfx = readStored(KEY_SFX);
  if (music === null && sfx === null) {
    const legacy = readStored(KEY_LEGACY);
    return legacy === null ? null : legacy ? 'on' : 'off';
  }
  return music || sfx ? 'on' : 'off';
}

function gainNode(context: AudioContext, value: number, destination: AudioNode | AudioParam): GainNode {
  const node = context.createGain();
  node.gain.value = value;
  // connect() has separate overloads for nodes and (modulated) params.
  if (destination instanceof AudioParam) node.connect(destination);
  else node.connect(destination);
  return node;
}

function buildAmbientPad(context: AudioContext, destination: AudioNode): void {
  // Slow tremolo lives on its own gain so it never leaks through a silenced bus.
  const pad = gainNode(context, 1, destination);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.7;
  filter.connect(pad);
  const voices: Array<[number, OscillatorType, number]> = [
    [110, 'sine', 0], // A2
    [164.81, 'triangle', 4], // E3
    [246.94, 'sine', -5], // B3
  ];
  for (const [frequency, type, detune] of voices) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    osc.connect(gainNode(context, 0.12, filter));
    osc.start();
  }
  const sweep = context.createOscillator();
  sweep.frequency.value = 0.05;
  sweep.connect(gainNode(context, 250, filter.frequency));
  sweep.start();
  const tremolo = context.createOscillator();
  tremolo.frequency.value = 0.11;
  tremolo.connect(gainNode(context, 0.15, pad.gain));
  tremolo.start();
}

function ensureGraph(): AudioContext | null {
  if (ctx) return ctx;
  if (!AudioContextCtor) return null;
  const context = new AudioContextCtor({ latencyHint: 'interactive' });
  counters.contexts += 1;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 4;
  compressor.connect(context.destination);
  master = gainNode(context, 0, compressor);
  sfxBus = gainNode(context, 0, master);
  ambientBus = gainNode(context, 0, master);
  musicBus = gainNode(context, 0, master);
  buildAmbientPad(context, ambientBus);
  ctx = context;
  return context;
}

function rampTo(param: AudioParam, value: number, timeConstant: number): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, timeConstant);
}

/** Bus levels follow the state; every change is a short ramp (no clicks, no jumps). */
function applyLevels(): void {
  if (!ctx || !master || !sfxBus || !musicBus || !ambientBus) return;
  const { musicEnabled, sfxEnabled, musicStatus, ducked } = snapshot;
  const anyOn = musicEnabled || sfxEnabled;
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  const masterLevel = anyOn && visible ? MASTER_LEVEL : 0;
  const sfx = sfxEnabled ? 1 : 0;
  const music = !musicEnabled || musicMuted || ducked ? 0 : musicScrubDucked ? SCRUB_DUCK_LEVEL : 1;
  // Owner decision: the pad belongs to Music and is the music layer only when this build has no playable track
  // (production without licensed audio, or a decode error). It never plays over, or instead of, a real track.
  const pad = musicEnabled && (musicStatus === 'unavailable' || musicStatus === 'error') && !ducked ? AMBIENT_LEVEL : 0;
  rampTo(master.gain, masterLevel, 0.06);
  rampTo(sfxBus.gain, sfx, 0.04);
  rampTo(musicBus.gain, music, 0.05);
  rampTo(ambientBus.gain, pad, 0.4);
  targets = { master: masterLevel, sfx, music, ambient: pad };
}

function settleContext(): void {
  const context = ctx;
  if (!context) return;
  window.clearTimeout(suspendTimer);
  if (snapshot.musicEnabled || snapshot.sfxEnabled) {
    if (context.state === 'suspended' && document.visibilityState === 'visible') void context.resume();
    return;
  }
  // Both off: fade out, then suspend so the context costs nothing.
  suspendTimer = window.setTimeout(() => {
    if (!snapshot.musicEnabled && !snapshot.sfxEnabled && context.state === 'running') void context.suspend();
  }, 400);
}

/** Music switch. Turning it on must happen inside a user gesture (it may create/resume the context). */
export function setMusicEnabled(on: boolean): boolean {
  if (on && !ensureGraph()) return false;
  store(KEY_MUSIC, on);
  emit({ musicEnabled: on, musicStatus: on ? (snapshot.musicStatus === 'off' ? 'loading' : snapshot.musicStatus) : 'off' });
  settleContext();
  applyLevels();
  return true;
}

/** SFX switch. Turning it on must happen inside a user gesture (it may create/resume the context). */
export function setSfxEnabled(on: boolean): boolean {
  if (on && !ensureGraph()) return false;
  store(KEY_SFX, on);
  emit({ sfxEnabled: on });
  settleContext();
  applyLevels();
  return true;
}

export const toggleMusic = (): boolean => setMusicEnabled(!snapshot.musicEnabled);
export const toggleSfx = (): boolean => setSfxEnabled(!snapshot.sfxEnabled);

/** Gate "enter with sound": both on. Returns false when Web Audio is unsupported. */
export function enableAll(): boolean {
  return setSfxEnabled(true) && setMusicEnabled(true);
}

/** Gate "enter without sound": both off (no context is created). */
export function disableAll(): void {
  setMusicEnabled(false);
  setSfxEnabled(false);
}

/** Reported by the music source (loading / ready / unavailable / error). Ignored while Music is off. */
export function setMusicStatus(status: MusicStatus): void {
  if (!snapshot.musicEnabled && status !== 'off') return;
  if (snapshot.musicStatus === status) return;
  emit({ musicStatus: status });
  applyLevels();
}

/** Controller: duck the soundtrack while the timeline is being scrubbed. */
export function setMusicScrubDucked(on: boolean): void {
  musicScrubDucked = on;
  applyLevels();
}

/** Controller: mute the soundtrack (e.g. a Previous/Next run while the user has paused). */
export function setMusicMuted(on: boolean): void {
  musicMuted = on;
  applyLevels();
}

/** A video is playing: duck music and ambience (SFX stay audible). */
export function duck(): void {
  if (snapshot.ducked) return;
  emit({ ducked: true });
  applyLevels();
}

export function unduck(): void {
  if (!snapshot.ducked) return;
  emit({ ducked: false });
  applyLevels();
}

/** Internal: the shared context and music bus for the music source (null before any gesture). */
export function getAudioGraph(): { ctx: AudioContext; musicBus: GainNode } | null {
  return ctx && musicBus ? { ctx, musicBus } : null;
}

function sfxReady(): boolean {
  return snapshot.sfxEnabled && !!ctx && !!sfxBus && ctx.state === 'running';
}

function voice(type: OscillatorType, from: number, to: number, duration: number, peak: number, delay = 0): void {
  if (!ctx || !sfxBus) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(sfxBus);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function getNoise(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, Math.round(context.sampleRate * 0.5), context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseSweep(duration: number, peak: number, fromHz = 300, toHz = 2400, q = 6): void {
  if (!ctx || !sfxBus) return;
  const start = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(fromHz, start);
  band.frequency.exponentialRampToValueAtTime(toHz, start + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(band).connect(env).connect(sfxBus);
  source.onended = () => {
    source.disconnect();
    band.disconnect();
    env.disconnect();
  };
  source.start(start);
  source.stop(start + duration + 0.02);
}

/** Plays a short effect; silent while SFX is off, the tab is hidden or the context is not running. */
export function play(name: SoundName): void {
  if (!sfxReady()) return;
  counters.sfxVoices += 1;
  switch (name) {
    case 'hover': {
      const now = performance.now();
      if (now - lastHoverAt < HOVER_THROTTLE_MS) return;
      lastHoverAt = now;
      voice('sine', 1800, 1400, 0.04, 0.05);
      return;
    }
    case 'tick':
      voice('triangle', 900, 900, 0.025, 0.04);
      return;
    case 'click':
      voice('sine', 520, 520, 0.09, 0.1);
      voice('sine', 780, 780, 0.07, 0.06, 0.01);
      return;
    case 'switch':
      noiseSweep(0.18, 0.08);
      return;
    case 'open':
      voice('sine', 220, 440, 0.16, 0.08);
      return;
    case 'close':
      voice('sine', 440, 220, 0.16, 0.08);
      return;
    case 'radio-off':
      // A set being switched off: a burst of static and a falling tone.
      noiseSweep(0.12, 0.05, 1600, 700, 2);
      voice('sine', 520, 90, 0.22, 0.07);
      return;
    case 'radio-on':
      voice('sine', 90, 520, 0.2, 0.07);
      noiseSweep(0.12, 0.05, 700, 1600, 2);
      return;
    case 'seek':
      // A short tape chirp while the transport jumps to a cue.
      noiseSweep(0.22, 0.07, 2600, 500, 4);
      return;
    case 'arrival':
      voice('sine', 140, 110, 0.18, 0.07);
      voice('triangle', 880, 880, 0.03, 0.02, 0.01);
      return;
  }
}

/* Tape scrub voice: one persistent filtered-noise source while the timeline is scrubbed (never one node per wheel event). */
let scrub: { source: AudioBufferSourceNode; band: BiquadFilterNode; env: GainNode } | null = null;

export function scrubVoice(action: 'start' | 'stop', dir: 1 | -1 = 1): void {
  if (action === 'stop') {
    if (!scrub || !ctx) return;
    const { source, band, env } = scrub;
    scrub = null;
    rampTo(env.gain, 0, 0.05);
    source.stop(ctx.currentTime + 0.3);
    source.onended = () => {
      source.disconnect();
      band.disconnect();
      env.disconnect();
    };
    return;
  }
  if (!sfxReady() || !ctx || !sfxBus) return;
  if (!scrub) {
    counters.sfxVoices += 1;
    const source = ctx.createBufferSource();
    source.buffer = getNoise(ctx);
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 3;
    const env = ctx.createGain();
    env.gain.value = 0;
    source.connect(band).connect(env).connect(sfxBus);
    source.start();
    scrub = { source, band, env };
  }
  // Forward reads brighter, rewind darker.
  rampTo(scrub.band.frequency, dir > 0 ? 2200 : 850, 0.05);
  rampTo(scrub.env.gain, 0.045, 0.04);
}

function onVisibilityChange(): void {
  const context = ctx;
  if (!context || !master) return;
  if (document.visibilityState === 'hidden') {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    void context.suspend();
  } else if (snapshot.musicEnabled || snapshot.sfxEnabled) {
    void context.resume().then(applyLevels);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange);
}

declare global {
  interface Window {
    /** Development-only handle for inspecting the sound layer from tests and devtools. */
    __t9Audio?: {
      getSnapshot: typeof getSnapshot;
      contextState: () => string | null;
      counters: () => { contexts: number; sfxVoices: number };
      contextTime: () => number | null;
      /** Bus gain targets last applied (not AudioParam.value, see `targets`). */
      levels: () => Record<string, number>;
    };
  }
}

if (import.meta.env.DEV) {
  window.__t9Audio = {
    getSnapshot,
    contextState: () => ctx?.state ?? null,
    counters: () => ({ ...counters }),
    contextTime: () => ctx?.currentTime ?? null,
    levels: () => ({ ...targets }),
  };
}
