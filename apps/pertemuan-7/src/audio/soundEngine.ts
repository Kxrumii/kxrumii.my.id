/*
 * Procedural sound layer (Web Audio API only: no files, no network requests).
 *
 * - The AudioContext is created lazily inside enable(), which must be called
 *   from a user gesture (gate button or sound toggle): autoplay-policy safe.
 * - Graph: voices -> sfxBus ─┐
 *          ambient pad -> ambientBus ─┴-> master -> compressor -> destination
 * - Hidden tab: master silenced and the context suspended; restored on return.
 * - duck()/unduck() fade the ambient pad out/in, e.g. while a video plays.
 */
export type SoundName = 'hover' | 'tick' | 'click' | 'switch' | 'open' | 'close';

export interface SoundSnapshot {
  supported: boolean;
  enabled: boolean;
  ducked: boolean;
}

const STORAGE_KEY = 't7:sound';
const MASTER_LEVEL = 0.9;
const AMBIENT_LEVEL = 0.3;
const HOVER_THROTTLE_MS = 60;

const AudioContextCtor: typeof AudioContext | null =
  typeof window !== 'undefined' && 'AudioContext' in window ? window.AudioContext : null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastHoverAt = 0;

let snapshot: SoundSnapshot = { supported: AudioContextCtor !== null, enabled: false, ducked: false };
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

/** Last choice made on this device ('on' | 'off'), used to pre-select the gate button. */
export function getStoredPreference(): 'on' | 'off' | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

function storePreference(value: 'on' | 'off'): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage disabled: preference simply isn't remembered */
  }
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
  // Slow tremolo lives on its own gain so it never leaks through a ducked/silenced bus.
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
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 4;
  compressor.connect(context.destination);
  master = gainNode(context, 0, compressor);
  sfxBus = gainNode(context, 1, master);
  ambientBus = gainNode(context, 0, master);
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

/** Turns sound on. Call only from a user gesture handler. Returns false when unsupported. */
export function enable(): boolean {
  const context = ensureGraph();
  if (!context || !master || !ambientBus) return false;
  void context.resume();
  rampTo(master.gain, MASTER_LEVEL, 0.08);
  rampTo(ambientBus.gain, snapshot.ducked ? 0 : AMBIENT_LEVEL, 0.4);
  storePreference('on');
  emit({ enabled: true });
  return true;
}

/** Turns sound off: fades out, then suspends the context so it costs no CPU. */
export function disable(): void {
  storePreference('off');
  emit({ enabled: false });
  const context = ctx;
  if (!context || !master) return;
  rampTo(master.gain, 0, 0.06);
  window.setTimeout(() => {
    if (!snapshot.enabled && context.state === 'running') void context.suspend();
  }, 400);
}

export function toggle(): void {
  if (snapshot.enabled) disable();
  else enable();
}

/** Fades the ambient pad out (e.g. while a video plays). Effects stay audible. */
export function duck(): void {
  if (snapshot.ducked) return;
  emit({ ducked: true });
  if (ambientBus) rampTo(ambientBus.gain, 0, 0.15);
}

export function unduck(): void {
  if (!snapshot.ducked) return;
  emit({ ducked: false });
  if (ambientBus && snapshot.enabled) rampTo(ambientBus.gain, AMBIENT_LEVEL, 0.5);
}

export const pauseAmbient = duck;
export const resumeAmbient = unduck;

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

function noiseSweep(duration: number, peak: number): void {
  if (!ctx || !sfxBus) return;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const start = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 6;
  band.frequency.setValueAtTime(300, start);
  band.frequency.exponentialRampToValueAtTime(2400, start + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + 0.03);
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

/** Plays a short interface sound; silently ignored while sound is off or the tab is hidden. */
export function play(name: SoundName): void {
  if (!snapshot.enabled || !ctx || ctx.state !== 'running') return;
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
  }
}

function onVisibilityChange(): void {
  const context = ctx;
  if (!context || !master) return;
  if (document.visibilityState === 'hidden') {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    void context.suspend();
  } else if (snapshot.enabled) {
    void context.resume().then(() => {
      if (master) rampTo(master.gain, MASTER_LEVEL, 0.2);
    });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange);
}

declare global {
  interface Window {
    /** Development-only handle for inspecting the sound layer from tests and devtools. */
    __t7Audio?: { getSnapshot: typeof getSnapshot; contextState: () => string | null; duck: typeof duck; unduck: typeof unduck };
  }
}

if (import.meta.env.DEV) {
  window.__t7Audio = { getSnapshot, contextState: () => ctx?.state ?? null, duck, unduck };
}
