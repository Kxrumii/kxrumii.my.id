import type { Work } from '../types';

/** Two-digit display number of a work (01, 02, …) from its position in the list. */
export function workNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function findWork(list: readonly Work[], slug: string | undefined): Work | null {
  if (!slug) return null;
  return list.find((work) => work.slug === slug) ?? null;
}

/** The work after `slug`, wrapping to the first one; null for an unknown slug or a list of one. */
export function nextWork(list: readonly Work[], slug: string): Work | null {
  const index = list.findIndex((work) => work.slug === slug);
  if (index < 0 || list.length < 2) return null;
  return list[(index + 1) % list.length];
}

/** Stable 32-bit FNV-1a hash, used to derive deterministic covers from a slug. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface CoverPalette {
  from: string;
  to: string;
  ink: string;
  angle: number;
}

/*
 * Generative covers for works without an image. Restrained duotones that sit on the near-black canvas;
 * the pop green appears in one palette only, so it stays an accent.
 */
const PALETTES: ReadonlyArray<Omit<CoverPalette, 'angle'>> = [
  { from: '#1d1d1d', to: '#3a3a3a', ink: '#fafafa' },
  { from: '#e6e6e6', to: '#bdbdbd', ink: '#0a0a0a' },
  { from: '#0f3d33', to: '#21ffc0', ink: '#0a0a0a' },
  { from: '#262021', to: '#6b5a55', ink: '#fafafa' },
  { from: '#1a1f2b', to: '#4a5672', ink: '#fafafa' },
  { from: '#fafafa', to: '#d9d4cc', ink: '#0a0a0a' },
];

export function coverPalette(slug: string): CoverPalette {
  const hash = hashString(slug);
  const palette = PALETTES[hash % PALETTES.length];
  return { ...palette, angle: 100 + ((hash >>> 8) % 140) };
}

/** Image URL for a work's cover: its own thumbnail, else the YouTube still, else null (generative cover). */
export function coverImage(work: Work): string | null {
  if (work.thumbnail) return work.thumbnail;
  if (work.youtubeVideoId) return `https://i.ytimg.com/vi/${encodeURIComponent(work.youtubeVideoId)}/hqdefault.jpg`;
  return null;
}
