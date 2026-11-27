/*
 * Karya Fahrii. Judul diambil dari judul YouTube / nama file owner (dengan koreksi owner); jenisnya hanya dari
 * istilah di judul itu sendiri ("[Mograph]", "Edit/AMV"). Tahun, peran, dan deskripsi BELUM diisi: jangan menebak.
 * Urutan array = urutan di spiral dan list.
 *
 * Gambar (`public/works/<slug>/`) dibuat oleh `tools/media.mjs`: sampul karya YouTube = thumbnail YouTube-nya,
 * styleframes = gambar sendiri / timestamp pilihan / frame otomatis (lihat komentar di skrip itu). Kalau jumlah
 * styleframe bukan 3, isi `frames` di sini dengan jumlah yang sama. Video penuh diputar dari YouTube; karya tanpa
 * `youtubeVideoId` menunggu link unlisted dari owner.
 */
import type { Work, WorkCategory } from '../types';

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  edit: 'edit',
  mograph: 'mograph',
};

/** Label kategori, atau "—" bila belum disebut. */
export function categoryLabel(work: Work): string {
  return work.category ? CATEGORY_LABELS[work.category] : '—';
}

const work = (slug: string, title: string, youtubeVideoId: string | null, category: WorkCategory | null, aspect = 16 / 9, frames = 3): Work => ({
  slug,
  title,
  year: null,
  category,
  role: null,
  summary: null,
  notes: null,
  cover: `works/${slug}/cover.webp`,
  styleframes: Array.from({ length: frames }, (_, i) => `works/${slug}/f${i + 1}.webp`),
  aspect,
  preview: true,
  youtubeVideoId,
  externalUrl: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null,
  isSample: false,
});

export const works: Work[] = [
  // Aspect ratios measured with ffprobe on the owner's files (2480×2160, 1440×1080); the rest are 16:9.
  work('last-friday-night', 'Last Friday Night', 'X7lZLkjGXXk', 'mograph', 2480 / 2160),
  work('a-signal-from-outer-space', 'A Signal From Outer Space', 'talzLiLx1fc', 'mograph'),
  work('love-letter-from-violet-evergarden', 'Love Letter From Violet Evergarden', 'SVuNZH-vqMg', null),
  work('oregairu-cinta-terbaik', 'Oregairu — Cinta Terbaik', 'qYnPTRtK7Xk', 'edit'),
  work('sousou-no-frieren-new-tank', 'Sousou no Frieren — New Tank', '6ZdKTaC54z8', 'edit', 4 / 3),
  work('ilusi-garis-kemiskinan', 'ILUSI GARIS KEMISKINAN', null, null),
  work('rahmatan-lil-alamin', 'Rahmatan Lil Alamin', null, null),
  work('sundays', 'Sundays', null, null),
];
