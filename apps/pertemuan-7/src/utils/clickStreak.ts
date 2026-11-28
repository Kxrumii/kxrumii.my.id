/*
 * Hitung klik beruntun (buat logo: tiga klik cepat = balik ke portal). Helper murni, jadi gampang dites.
 */

/** Jeda maksimal (ms) dari klik pertama sampai klik terakhir dalam satu rentetan. */
export const STREAK_WINDOW_MS = 1200;
/** Berapa klik yang dibutuhkan. */
export const STREAK_CLICKS = 3;

export interface StreakResult {
  /** Waktu klik yang masih dalam jendela (di-reset kalau rentetannya sudah tercapai). */
  clicks: number[];
  reached: boolean;
}

export function registerClick(clicks: readonly number[], nowMs: number, windowMs = STREAK_WINDOW_MS, needed = STREAK_CLICKS): StreakResult {
  const recent = [...clicks.filter((at) => nowMs - at <= windowMs && at <= nowMs), nowMs];
  if (recent.length >= needed) return { clicks: [], reached: true };
  return { clicks: recent, reached: false };
}
