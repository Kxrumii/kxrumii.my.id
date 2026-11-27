/*
 * Sound for the portfolio: ONE lazily created AudioContext, Web Audio only, no audio files.
 *
 *   SFX voices  -> sfxBus     ─┐
 *   ambient pad -> ambientBus ─┴─> master -> compressor -> destination
 *
 * - One switch ("sound"). Every document load starts silent; the loader asks ("enter with sound" / "enter
 *   without sound"), like the reference site, and the bottom-right button toggles it afterwards.
 * - The context is only created from a user gesture (autoplay-policy safe).
 * - Hidden tab or sound off: master faded out and the context suspended, so it costs no CPU.
 * - The ambient pad is procedural (no copyrighted music is shipped).
 */
export type SoundName = 'hover' | 'click' | 'open' | 'close' | 'enter';

export interface SoundSnapshot {
  supported: boolean;
  enabled: boolean;
}

const MASTER_LEVEL = 0.85;
const AMBIENT_LEVEL = 0.22;
const HOVER_THROTTLE_MS = 70;

const AudioContextCtor: typeof AudioContext | null =
  typeof window !== 'undefined' && 'AudioContext' in window ? window.AudioContext : null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ambientStarted = false;
let lastHoverAt = 0;
let suspendTimer = 0;

let snapshot: SoundSnapshot = { supported: AudioContextCtor !== null, enabled: false };
const listeners = new Set<() => void>();

function emit(next: Partial<SoundSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSoundSnapshot(): SoundSnapshot {
  return snapshot;
}

function ensureContext(): AudioContext | null {
  if (ctx || !AudioContextCtor) return ctx;
  ctx = new AudioContextCtor();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = 0;
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 1;
  ambientBus = ctx.createGain();
  ambientBus.gain.value = 0;
  sfxBus.connect(master);
  ambientBus.connect(master);
  master.connect(compressor).connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Two slow detuned voices through a breathing low-pass: a quiet bed under the interface sounds. */
function startAmbient(): void {
  if (!ctx || !ambientBus || ambientStarted) return;
  ambientStarted = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 0.6;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  for (const [freq, type, level] of [
    [110, 'sine', 0.5],
    [164.81, 'triangle', 0.18],
    [220.6, 'sine', 0.16],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = level;
    osc.connect(gain).connect(filter);
    osc.start();
  }
  filter.connect(ambientBus);
}

function applyLevels(): void {
  if (!ctx || !master || !ambientBus) return;
  const now = ctx.currentTime;
  const audible = snapshot.enabled && document.visibilityState === 'visible';
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(audible ? MASTER_LEVEL : 0, now, audible ? 0.12 : 0.05);
  ambientBus.gain.cancelScheduledValues(now);
  ambientBus.gain.setTargetAtTime(audible ? AMBIENT_LEVEL : 0, now, 0.8);
  window.clearTimeout(suspendTimer);
  if (audible) {
    if (ctx.state === 'suspended') void ctx.resume();
  } else {
    suspendTimer = window.setTimeout(() => {
      if (ctx && ctx.state === 'running') void ctx.suspend();
    }, 400);
  }
}

/** Turns sound on or off. Must be called from a user gesture the first time it turns sound on. */
export function setSoundEnabled(enabled: boolean): void {
  if (!snapshot.supported) return;
  emit({ enabled });
  if (enabled) {
    ensureContext();
    startAmbient();
  }
  applyLevels();
}

export function toggleSound(): void {
  setSoundEnabled(!snapshot.enabled);
}

function envelope(gain: GainNode, at: number, peak: number, attack: number, release: number): void {
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
}

function tone(freq: number, at: number, peak: number, release: number, type: OscillatorType = 'sine'): void {
  if (!ctx || !sfxBus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  envelope(gain, at, peak, 0.004, release);
  osc.connect(gain).connect(sfxBus);
  osc.start(at);
  osc.stop(at + release + 0.05);
}

function whoosh(at: number, from: number, to: number, duration: number, peak: number): void {
  if (!ctx || !sfxBus || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + duration * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(sfxBus);
  source.start(at);
  source.stop(at + duration + 0.05);
}

/** Plays an interface sound when sound is on (no-op otherwise). */
export function playSound(name: SoundName): void {
  if (!snapshot.enabled || !ctx || ctx.state !== 'running' || document.visibilityState !== 'visible') return;
  const at = ctx.currentTime + 0.005;
  switch (name) {
    case 'hover': {
      const nowMs = performance.now();
      if (nowMs - lastHoverAt < HOVER_THROTTLE_MS) return;
      lastHoverAt = nowMs;
      tone(2100, at, 0.05, 0.04);
      break;
    }
    case 'click':
      tone(880, at, 0.12, 0.08, 'triangle');
      tone(1320, at + 0.03, 0.06, 0.08);
      break;
    case 'open':
      whoosh(at, 300, 2400, 0.42, 0.22);
      break;
    case 'close':
      whoosh(at, 2400, 260, 0.36, 0.2);
      break;
    case 'enter':
      tone(523.25, at, 0.12, 0.6);
      tone(783.99, at + 0.09, 0.1, 0.7);
      tone(1046.5, at + 0.18, 0.07, 0.9);
      break;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', applyLevels);
}
