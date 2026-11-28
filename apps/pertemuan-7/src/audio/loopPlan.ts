/*
 * Jadwal murni buat nge-loop SELURUH lagu dengan crossfade (nggak ada Web Audio di sini, jadi bisa di-unit-test).
 *
 * Segment 0 mulai di waktu context `whenS` dari offset lagu `offsetS` sampai ujung file. Tiap segment berikutnya
 * mulai dari awal file `crossfadeS` sebelum yang sebelumnya habis: ekor yang keluar fade out selama `crossfadeS`
 * terakhir, kepala yang masuk fade in. Titik loop nggak ditebak, sambungannya ya langsung ujung → awal.
 * (Diadaptasi dari crossfade scheduler showroom Task 7 yang lama, ada di branch archive/pertemuan-9-showroom.)
 */

export interface SongSegment {
  index: number;
  /** Waktu context saat node mulai. */
  startAt: number;
  offset: number;
  /** Jendela fade in; null buat segment pertama (cuma dapat ramp pendek biar nggak ngeklik). */
  fadeIn: { from: number; to: number } | null;
  fadeOut: { from: number; to: number };
  /** Waktu context saat file habis (ujung fade out). */
  endAt: number;
}

export interface SongLoopInput {
  whenS: number;
  offsetS: number;
  durationS: number;
  crossfadeS: number;
}

export function loopPeriod({ durationS, crossfadeS }: Pick<SongLoopInput, 'durationS' | 'crossfadeS'>): number {
  return durationS - crossfadeS;
}

export function segmentAt(input: SongLoopInput, index: number): SongSegment {
  const { whenS, offsetS, durationS, crossfadeS } = input;
  const firstEnd = whenS + (durationS - offsetS);
  const startAt = index === 0 ? whenS : firstEnd - crossfadeS + (index - 1) * loopPeriod(input);
  const offset = index === 0 ? offsetS : 0;
  const endAt = startAt + (durationS - offset);
  return {
    index,
    startAt,
    offset,
    fadeIn: index === 0 ? null : { from: startAt, to: startAt + crossfadeS },
    fadeOut: { from: endAt - crossfadeS, to: endAt },
    endAt,
  };
}

/** Segment dengan index >= fromIndex yang mulai sebelum `untilS`. */
export function planSongSegments(input: SongLoopInput, untilS: number, fromIndex = 0): SongSegment[] {
  if (!(input.durationS > input.crossfadeS * 2) || input.crossfadeS < 0) return [];
  const out: SongSegment[] = [];
  for (let index = fromIndex; ; index += 1) {
    const segment = segmentAt(input, index);
    if (segment.startAt >= untilS) break;
    out.push(segment);
  }
  return out;
}

/** Kurva fade equal-power dengan `n` titik (sin buat masuk, cos buat keluar); in² + out² = 1 di tiap titik. */
export function equalPowerCurve(n: number, direction: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = n === 1 ? 1 : i / (n - 1);
    curve[i] = direction === 'in' ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2);
  }
  return curve;
}
