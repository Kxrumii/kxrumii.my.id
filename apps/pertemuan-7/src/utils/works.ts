import type { Work } from '../types';

/** Nomor tampilan dua digit sebuah karya (01, 02, …) dari posisinya di list. */
export function workNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function findWork(list: readonly Work[], slug: string | undefined): Work | null {
  if (!slug) return null;
  return list.find((work) => work.slug === slug) ?? null;
}

/** Karya setelah `slug`, balik ke yang pertama di ujung; null buat slug yang nggak dikenal atau list isi satu. */
export function nextWork(list: readonly Work[], slug: string): Work | null {
  const index = list.findIndex((work) => work.slug === slug);
  if (index < 0 || list.length < 2) return null;
  return list[(index + 1) % list.length];
}

/** Karya sebelum `slug`, balik ke yang terakhir di ujung; null buat slug yang nggak dikenal atau list isi satu. */
export function prevWork(list: readonly Work[], slug: string): Work | null {
  const index = list.findIndex((work) => work.slug === slug);
  if (index < 0 || list.length < 2) return null;
  return list[(index - 1 + list.length) % list.length];
}

/** URL file di folder public app (menghormati base Vite, mis. /tugas/pertemuan-7/). */
export function assetUrl(path: string): string {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}

/** Loop preview muted: local-media pas development, media/previews di server (upload manual). */
export function previewUrl(work: Work): string | null {
  if (!work.preview) return null;
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  return assetUrl(env?.DEV ? `local-media/previews/${work.slug}.mp4` : `media/previews/${work.slug}.mp4`);
}

/** Hash FNV-1a 32-bit yang stabil, buat menurunkan cover deterministik dari slug. */
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
 * Cover generatif buat karya tanpa gambar. Duotone kalem yang menyatu dengan canvas hampir hitam;
 * hijau pop cuma muncul di satu palet, biar tetap jadi aksen.
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

/** URL gambar cover karya: still sendiri, kalau nggak ada still YouTube, kalau nggak ada null (cover generatif). */
export function coverImage(work: Work): string | null {
  if (work.cover) return assetUrl(work.cover);
  if (work.youtubeVideoId) return `https://i.ytimg.com/vi/${encodeURIComponent(work.youtubeVideoId)}/hqdefault.jpg`;
  return null;
}
