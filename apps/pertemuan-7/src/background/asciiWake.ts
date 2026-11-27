/*
 * ASCII wake: pure state for the cursor trail (own implementation, written from the description of
 * "Background ASCII Wake" by @nikolas-sapa on 21st.dev; its code was not available).
 *
 * The screen is a grid of monospace cells. Moving the pointer pours "energy" into the cells along its path; the
 * faster it moves, the more energy (brighter, longer trail). Energy decays over time and each cell's character
 * thins out with it (dense → light). A sparse, dim scatter of characters sits at rest underneath.
 */
import type { Rng } from './pixelStars';

export const WAKE_CELL = 16;
/** Dense → light: the character shown for a cell's remaining energy. */
export const WAKE_RAMP = ['·', '.', ':', '-', '+', '*', '%', '#'] as const;
export const WAKE_MAX_CELLS = 140;
const SAMPLE_SPACING = 7;
/** Pointer speed (px/ms) that counts as "fast": full energy, full brightness. */
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

/** 0–1 speed factor for a pointer speed in px/ms. */
export function speedFactor(speedPxPerMs: number): number {
  if (!Number.isFinite(speedPxPerMs) || speedPxPerMs <= 0) return 0;
  return Math.min(speedPxPerMs / FAST_SPEED, 1);
}

/**
 * Feeds one pointer sample. Returns the speed factor of the movement since the previous sample
 * (0 for the first sample or after a long pause).
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
      // Re-insert so the Map order stays "least recently fed first" for the cap below.
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

/** Decays every cell by dt seconds (full energy lasts `lifeS`); removes empty cells. */
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

/** The resting scatter: a few dim characters on the cell grid (about 3 % of cells). */
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
