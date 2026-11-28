import { startMusic, type MusicStatus } from './music';

/*
 * Sound portfolio: SATU AudioContext yang dibuat lazy, cuma Web Audio.
 *
 *   musik (loop Shelter, lihat music.ts)  -> musicBus ─┐
 *   SFX interface (prosedural)            -> sfxBus   ─┴─> master -> compressor -> destination
 *
 * - Satu switch ("sound") ngatur musik dan SFX sekaligus. Tiap load dokumen mulai senyap; gate nanya
 *   ("enter with sound" / "enter without sound"), habis itu tombol kanan bawah yang toggle.
 * - Context baru dibuat dari user gesture (aman buat autoplay policy).
 * - Sound off atau tab hidden: master fade out dan context di-suspend. Suspend membekukan clock context,
 *   jadi jadwal musik tinggal pause dan lanjut di tempat.
 * - Video yang lagi main bikin musik ducking.
 */
export type SoundName = 'hover' | 'click' | 'open' | 'close' | 'enter' | 'switch' | 'spiral' | 'list' | 'next' | 'stars' | 'trail' | 'ripple';

export interface SoundSnapshot {
  supported: boolean;
  enabled: boolean;
  music: MusicStatus;
}

const MASTER_LEVEL = 0.85;
const MUSIC_LEVEL = 0.55;
/** Pas ada video main, musik dimatiin total. */
const MUSIC_DUCK_LEVEL = 0;
/** SFX dikeraskan +6 dB lewat bus ini, soalnya sebelumnya kurang kedengeran. */
const SFX_LEVEL = 2;
const HOVER_THROTTLE_MS = 70;
const TRAIL_THROTTLE_MS = 95;

const AudioContextCtor: typeof AudioContext | null =
  typeof window !== 'undefined' && 'AudioContext' in window ? window.AudioContext : null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ducked = false;
let lastHoverAt = 0;
let lastTrailAt = 0;
let suspendTimer = 0;

let snapshot: SoundSnapshot = { supported: AudioContextCtor !== null, enabled: false, music: 'idle' };
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
  sfxBus.gain.value = SFX_LEVEL;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(compressor).connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function applyLevels(): void {
  if (!ctx || !master || !musicBus) return;
  const now = ctx.currentTime;
  const audible = snapshot.enabled && document.visibilityState === 'visible';
  master.gain.cancelScheduledValues(now);
  // On: langsung level penuh, biar klik pertama (pilihan di gate) kedengeran. Off: fade pendek.
  if (audible) master.gain.setValueAtTime(MASTER_LEVEL, now);
  else master.gain.setTargetAtTime(0, now, 0.05);
  musicBus.gain.cancelScheduledValues(now);
  // Musik naik pelan (sekitar 1.5 s) dan ducking pas ada video main.
  musicBus.gain.setTargetAtTime(audible ? (ducked ? MUSIC_DUCK_LEVEL : MUSIC_LEVEL) : 0, now, audible ? 0.5 : 0.05);
  window.clearTimeout(suspendTimer);
  if (audible) {
    if (ctx.state === 'suspended') void ctx.resume();
  } else {
    suspendTimer = window.setTimeout(() => {
      if (ctx && ctx.state === 'running') void ctx.suspend();
    }, 400);
  }
}

/** Nyalain/matiin sound. Pertama kali nyalain harus dari user gesture. */
export function setSoundEnabled(enabled: boolean): void {
  if (!snapshot.supported) return;
  emit({ enabled });
  if (enabled) {
    const context = ensureContext();
    if (context && musicBus) startMusic(context, musicBus, (music) => emit({ music }));
  }
  applyLevels();
}

export function toggleSound(): void {
  setSoundEnabled(!snapshot.enabled);
}

export function setMusicDucked(value: boolean): void {
  if (ducked === value) return;
  ducked = value;
  applyLevels();
}

function envelope(gain: GainNode, at: number, peak: number, attack: number, release: number): void {
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
}

function tone(freq: number, at: number, peak: number, release: number, type: OscillatorType = 'sine', attack = 0.004): void {
  if (!ctx || !sfxBus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  envelope(gain, at, peak, attack, release);
  osc.connect(gain).connect(sfxBus);
  osc.start(at);
  osc.stop(at + attack + release + 0.05);
}

function filteredNoise(at: number, from: number, to: number, duration: number, peak: number, type: BiquadFilterType = 'bandpass'): void {
  if (!ctx || !sfxBus || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
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

/** Tangga pentatonik (kira-kira A minor) biar sparkle yang numpuk nggak tabrakan. */
const SPARKLE = [880, 987.77, 1174.66, 1318.51, 1567.98, 1760, 1975.53, 2349.32];

/**
 * Mainin SFX interface kalau sound on (kalau off nggak ngapa-ngapain). `amount` (0–1) ngatur yang kontinu,
 * mis. kecepatan kursor buat `trail`.
 */
export function playSound(name: SoundName, amount = 0.5, afterResume = false): void {
  if (!snapshot.enabled || !ctx || document.visibilityState !== 'visible') return;
  // Context yang baru dibuat gesture ini bisa aja masih starting: mainin begitu udah running.
  if (ctx.state === 'suspended' && !afterResume) {
    void ctx.resume().then(() => playSound(name, amount, true));
    return;
  }
  if (ctx.state !== 'running') return;
  const at = ctx.currentTime + 0.005;
  const nowMs = performance.now();
  switch (name) {
    case 'hover':
      if (nowMs - lastHoverAt < HOVER_THROTTLE_MS) return;
      lastHoverAt = nowMs;
      tone(2100, at, 0.08, 0.04);
      break;
    case 'click':
      // Pendek dan tajam: tick noise high-pass di atas pop sine singkat.
      filteredNoise(at, 4200, 2600, 0.03, 0.32, 'highpass');
      tone(1480, at, 0.16, 0.035, 'sine', 0.001);
      tone(740, at + 0.004, 0.08, 0.05, 'triangle', 0.001);
      break;
    case 'open':
      filteredNoise(at, 300, 2400, 0.42, 0.22);
      break;
    case 'close':
      filteredNoise(at, 2400, 260, 0.36, 0.2);
      break;
    case 'enter':
      tone(523.25, at, 0.12, 0.6);
      tone(783.99, at + 0.09, 0.1, 0.7);
      tone(1046.5, at + 0.18, 0.07, 0.9);
      break;
    case 'spiral':
      // Swirl naik ke arah coil.
      filteredNoise(at, 320, 2600, 0.34, 0.14);
      tone(523.25, at + 0.04, 0.05, 0.22, 'sine', 0.01);
      tone(783.99, at + 0.12, 0.045, 0.3, 'sine', 0.01);
      break;
    case 'list':
      // Tiga tick turun cepat, kayak baris yang jatuh ke tempatnya.
      [1760, 1318.51, 987.77].forEach((freq, i) => tone(freq, at + i * 0.055, 0.06, 0.05, 'triangle', 0.001));
      break;
    case 'switch':
      filteredNoise(at, 900, 3200, 0.22, 0.12);
      tone(660, at + 0.05, 0.06, 0.12, 'triangle');
      break;
    case 'next':
      filteredNoise(at, 200, 3000, 0.6, 0.18);
      tone(659.25, at + 0.12, 0.09, 0.5);
      tone(987.77, at + 0.22, 0.07, 0.7);
      break;
    case 'stars':
      // Shimmer naik pas bintang-bintang muncul.
      SPARKLE.forEach((freq, i) => tone(freq, at + i * 0.07, 0.035, 0.5, 'sine', 0.01));
      break;
    case 'trail': {
      if (nowMs - lastTrailAt < TRAIL_THROTTLE_MS) return;
      lastTrailAt = nowMs;
      const k = Math.min(Math.max(amount, 0), 1);
      const freq = SPARKLE[Math.min(SPARKLE.length - 1, Math.floor(k * SPARKLE.length))] * 2;
      tone(freq, at, 0.02 + 0.032 * k, 0.05, 'sine', 0.002);
      break;
    }
    case 'ripple':
      tone(110, at, 0.14, 0.35, 'sine', 0.005);
      tone(1318.51, at + 0.02, 0.05, 1.1, 'sine', 0.01);
      tone(1975.53, at + 0.05, 0.03, 1.3, 'sine', 0.01);
      break;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', applyLevels);
}

declare global {
  interface Window {
    /** Cuma buat development: read-out buat QA lewat script. */
    __t7Sound?: () => SoundSnapshot;
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') window.__t7Sound = getSoundSnapshot;
