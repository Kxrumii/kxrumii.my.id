/*
 * ASCII wake: state murni buat trail kursor (implementasi sendiri, aku tulis dari deskripsi
 * "Background ASCII Wake" karya @nikolas-sapa di 21st.dev; kodenya nggak tersedia).
 *
 * Layar itu grid sel monospace. Pointer yang gerak menuangkan "energi" ke sel-sel di jalurnya; makin cepat
 * gerakannya makin banyak energinya (lebih terang, trail lebih panjang). Energi meluruh seiring waktu dan karakter
 * tiap sel ikut menipis (rapat → ringan). Di bawahnya ada sebaran karakter jarang yang redup saat diam.
 */
import type { Rng } from './pixelStars';

export const WAKE_CELL = 16;
/** Rapat → ringan: karakter yang tampil buat sisa energi sebuah sel. */
export const WAKE_RAMP = ['·', '.', ':', '-', '+', '*', '%', '#'] as const;
export const WAKE_MAX_CELLS = 140;
const SAMPLE_SPACING = 7;
/** Kecepatan pointer (px/ms) yang dianggap "cepat": energi dan kecerahan penuh. */
const FAST_SPEED = 2.4;

export interface WakeCell {
  col: number;
  row: number;
  energy: number;
}

export interface WakeState {
  cells: Map<string, WakeCell>;
  last: { x: number; y: number; t: number } | null;
}

export function createWake(): WakeState {
  return { cells: new Map(), last: null };
}

/** Faktor kecepatan 0–1 dari kecepatan pointer dalam px/ms. */
export function speedFactor(speedPxPerMs: number): number {
  if (!Number.isFinite(speedPxPerMs) || speedPxPerMs <= 0) return 0;
  return Math.min(speedPxPerMs / FAST_SPEED, 1);
}

/**
 * Masukin satu sampel pointer. Balikannya faktor kecepatan gerakan sejak sampel sebelumnya
 * (0 buat sampel pertama atau setelah jeda lama).
 */
export function addPointer(state: WakeState, x: number, y: number, tMs: number): number {
  const last = state.last;
  state.last = { x, y, t: tMs };
  if (!last || tMs - last.t > 250) return 0;
  const dx = x - last.x;
  const dy = y - last.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  const factor = speedFactor(dist / Math.max(tMs - last.t, 1));
  const gain = 0.35 + 0.65 * factor;
  const steps = Math.max(1, Math.ceil(dist / SAMPLE_SPACING));
  for (let i = 1; i <= steps; i += 1) {
    const px = last.x + (dx * i) / steps;
    const py = last.y + (dy * i) / steps;
    const col = Math.floor(px / WAKE_CELL);
    const row = Math.floor(py / WAKE_CELL);
    const key = `${col}:${row}`;
    const cell = state.cells.get(key);
    if (cell) {
      cell.energy = Math.min(1, cell.energy + gain * 0.5);
      // Dimasukin ulang biar urutan Map tetap "paling lama nggak diisi duluan" buat batas di bawah.
      state.cells.delete(key);
      state.cells.set(key, cell);
    } else {
      state.cells.set(key, { col, row, energy: gain });
    }
  }
  while (state.cells.size > WAKE_MAX_CELLS) {
    const oldest = state.cells.keys().next().value;
    if (oldest === undefined) break;
    state.cells.delete(oldest);
  }
  return factor;
}

/** Luruhkan semua sel sebesar dt detik (energi penuh bertahan `lifeS`); sel kosong dihapus. */
export function stepWake(state: WakeState, dtS: number, lifeS = 0.9): void {
  const loss = Math.max(dtS, 0) / lifeS;
  for (const [key, cell] of state.cells) {
    cell.energy -= loss;
    if (cell.energy <= 0) state.cells.delete(key);
  }
}

export function charFor(energy: number): string {
  const e = Math.min(Math.max(energy, 0), 1);
  return WAKE_RAMP[Math.min(WAKE_RAMP.length - 1, Math.floor(e * WAKE_RAMP.length))];
}

export interface ScatterGlyph {
  x: number;
  y: number;
  char: string;
  alpha: number;
}

/** Sebaran diam: beberapa karakter redup di grid sel (sekitar 3 % sel). */
export function ambientScatter(width: number, height: number, rng: Rng, fraction = 0.03): ScatterGlyph[] {
  const cols = Math.ceil(width / WAKE_CELL);
  const rows = Math.ceil(height / WAKE_CELL);
  const out: ScatterGlyph[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (rng() >= fraction) continue;
      out.push({
        x: col * WAKE_CELL,
        y: row * WAKE_CELL,
        char: WAKE_RAMP[Math.floor(rng() * 4)],
        alpha: 0.06 + rng() * 0.1,
      });
    }
  }
  return out;
}
