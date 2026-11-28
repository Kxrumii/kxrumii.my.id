/*
 * "Keep scrolling ke project berikutnya": helper murni. Begitu halaman mentok di bawah, input wheel, touch-drag,
 * atau keyboard berikutnya ngisi progress bar; bar surut kalau input berhenti; penuh artinya "pindah ke karya
 * berikutnya".
 */

/** Jarak scroll (px) yang ngisi bar dari kosong. */
export const FILL_DISTANCE_PX = 900;
/** Seberapa cepat bar surut pas idle (pecahan per detik). */
export const DRAIN_PER_S = 0.45;
/** Waktu idle (ms) sebelum mulai surut. */
export const DRAIN_DELAY_MS = 220;

const LINE_PX = 18;

/** Delta wheel dalam px apa pun deltaMode-nya (0 pixel, 1 line, 2 page). */
export function normalizeWheel(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (!Number.isFinite(deltaY)) return 0;
  const unit = deltaMode === 1 ? LINE_PX : deltaMode === 2 ? pageHeight : 1;
  return Math.max(Math.min(deltaY * unit, 240), -240);
}

/** Tambah jarak scroll (positif = ke karya berikutnya) ke progress, di-clamp ke [0, 1]. */
export function accumulate(progress: number, px: number, distance = FILL_DISTANCE_PX): number {
  if (!Number.isFinite(px) || distance <= 0) return progress;
  return Math.min(Math.max(progress + px / distance, 0), 1);
}

export function drain(progress: number, dtS: number, rate = DRAIN_PER_S): number {
  return Math.max(0, progress - Math.max(dtS, 0) * rate);
}

export function isAtBottom(scrollY: number, viewportHeight: number, scrollHeight: number, tolerance = 2): boolean {
  return scrollY + viewportHeight >= scrollHeight - tolerance;
}

export function isComplete(progress: number): boolean {
  return progress >= 1;
}

export type Edge = 'top' | 'bottom' | 'both' | null;

/** Viewport ada di ujung mana ('both' kalau halaman muat di viewport). */
export function edgeOf(scrollY: number, viewportHeight: number, scrollHeight: number, tolerance = 2): Edge {
  const top = scrollY <= tolerance;
  const bottom = isAtBottom(scrollY, viewportHeight, scrollHeight, tolerance);
  return top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : null;
}

/** Lama setelah tiba di halaman di mana input tepi diabaikan (momentum trackpad nggak boleh merantai halaman). */
export const ARRIVAL_COOLDOWN_MS = 700;
/** Viewport harus sudah diam di tepi selama ini sebelum input di situ dihitung. */
export const EDGE_SETTLE_MS = 150;

/** Apakah input di tepi boleh ngisi bar sekarang. */
export function edgeReady(nowMs: number, arrivedAtMs: number, edgeSinceMs: number | null): boolean {
  if (edgeSinceMs === null) return false;
  return nowMs - arrivedAtMs >= ARRIVAL_COOLDOWN_MS && nowMs - edgeSinceMs >= EDGE_SETTLE_MS;
}

/** Arah yang ditunjuk niat scroll di tepi tertentu: turun di bawah → next, naik di atas → prev. */
export function edgeIntent(edge: Edge, deltaPx: number): 'next' | 'prev' | null {
  if (deltaPx > 0 && (edge === 'bottom' || edge === 'both')) return 'next';
  if (deltaPx < 0 && (edge === 'top' || edge === 'both')) return 'prev';
  return null;
}
