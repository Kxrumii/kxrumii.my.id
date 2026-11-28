/*
 * Karya-karyaku. Judul diambil dari judul YouTube / nama file asli (sebagian kukoreksi), deskripsinya tulisanku
 * sendiri. Yang nggak ada buktinya dibiarkan null (tampil "—"), mis. tahun. Urutan array = urutan di spiral dan list.
 *
 * Gambar (`public/works/<slug>/`) dibuat `tools/media.mjs`: sampul karya YouTube = thumbnail YouTube-nya,
 * styleframes = gambar sendiri / timestamp pilihan / frame otomatis (lihat komentar di skrip itu). Kalau jumlah
 * styleframe bukan 3, isi `frames` di sini dengan jumlah yang sama. Video penuh diputar dari YouTube; karya tanpa
 * `youtubeVideoId` nunggu link unlisted dariku.
 */
import type { Work, WorkCategory } from '../types';

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  edit: 'edit',
  mograph: 'mograph',
  film: 'film',
  video: 'video',
};

/** Label kategori, atau "—" kalau belum disebut. */
export function categoryLabel(work: Work): string {
  return work.category ? CATEGORY_LABELS[work.category] : '—';
}

interface WorkDetails {
  youtubeVideoId: string | null;
  category: WorkCategory | null;
  year?: number | null;
  role?: string | null;
  summary?: string | null;
  notes?: string | null;
  /** Rasio tampilan video (lebar / tinggi); default 16:9. */
  aspect?: number;
  /** Jumlah styleframe di public/works/<slug>/ (f1…fN); default 3. */
  frames?: number;
  /** Ada loop preview lokal (local-media/previews/<slug>.mp4); default true. */
  preview?: boolean;
}

const work = (slug: string, title: string, details: WorkDetails): Work => {
  const { youtubeVideoId, category, year = null, role = null, summary = null, notes = null, aspect = 16 / 9, frames = 3, preview = true } = details;
  return {
    slug,
    title,
    year,
    category,
    role,
    summary,
    notes,
    cover: `works/${slug}/cover.webp`,
    styleframes: Array.from({ length: frames }, (_, i) => `works/${slug}/f${i + 1}.webp`),
    aspect,
    preview,
    youtubeVideoId,
    externalUrl: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null,
    isSample: false,
  };
};

export const works: Work[] = [
  // Aspect ratio diukur pakai ffprobe dari file aslinya (2480×2160, 1440×1080); sisanya 16:9.
  work('last-friday-night', 'Last Friday Night', {
    youtubeVideoId: 'X7lZLkjGXXk',
    category: 'mograph',
    role: 'motion graphic',
    aspect: 2480 / 2160,
    summary: 'Motion graphic buat lagu Last Friday Night. Ini remake dari karyanya y6richo.',
  }),
  work('a-signal-from-outer-space', 'A Signal From Outer Space', {
    youtubeVideoId: 'talzLiLx1fc',
    category: 'mograph',
    year: 2024,
    role: 'motion graphic',
    summary:
      'Motion graphic dari lagu A Signal From Outer Space-nya Park Bird, terinspirasi dari karya 안재민, 표한빈, dan 박정우. Sebenernya ini kupakai buat UAS Pengenalan Informatika, hehe.',
  }),
  work('love-letter-from-violet-evergarden', 'Love Letter From Violet Evergarden', {
    youtubeVideoId: 'SVuNZH-vqMg',
    category: 'edit',
    role: 'editing',
    summary:
      'Ini AMV yang kuikutin di Casper AMV Challenge. Aku pengin nge-highlight momen waktu Violet baca surat, dengan visual yang sedikit ngejelasin apa yang terjadi, sampai akhirnya Violet belajar apa itu cinta.',
  }),
  work('oregairu-cinta-terbaik', 'Oregairu — Cinta Terbaik', {
    youtubeVideoId: 'qYnPTRtK7Xk',
    category: 'edit',
    role: 'editing',
    summary: 'Simpelnya, AMV ini soal penolakan. Kenapa aku edit? Ya... aku nonton, dan... aku dukung Yui. :)',
  }),
  work('sousou-no-frieren-new-tank', 'Sousou no Frieren — New Tank', {
    youtubeVideoId: '6ZdKTaC54z8',
    category: 'edit',
    role: 'editing',
    aspect: 4 / 3,
    summary:
      'Ini percobaanku bikin AMV flow, remake dari Suchiefx. AMV flow itu apa? AMV yang alur tiap scene-nya ngalir, jadi gerakan kamera atau aksi di satu scene nyambung mulus ke scene berikutnya.',
  }),
  work('uin-one-for-all', 'UIN ONE FOR ALL', {
    youtubeVideoId: 'KbnBCMy2QwM',
    category: 'video',
    // Nggak ada file lokalnya, jadi nggak ada loop preview; styleframe-nya dari frame otomatis YouTube.
    preview: false,
    summary:
      'Video dokumentasi proyek sosial buat mata kuliah SPI. Di sini aku dan kelompokku bantu nyebarin info soal akun mahasiswa. Selengkapnya cek aja langsung di video YouTube-nya.',
  }),
  work('ilusi-garis-kemiskinan', 'ILUSI GARIS KEMISKINAN', {
    youtubeVideoId: null,
    category: 'video',
    summary:
      'Entryku buat lomba videografis PTKIN II. Isinya video penjelasan soal garis kemiskinan, dan dari judulnya aja aku mau ngajak kamu nanya: angka itu beneran nunjukin kondisi orang, atau cuma ilusi? Datanya kubawain lewat motion graphic, ditambah voice over obrolan dua orang dengan gaya rekaman kamera VHS. Oh iya, menang juara 2 btw :3',
  }),
  work('rahmatan-lil-alamin', 'Rahmatan Lil Alamin', {
    youtubeVideoId: null,
    category: 'film',
    summary:
      'Entryku buat lomba video pendek di PBAK UIN, temanya Rahmatan Lil Alamin. Di sini aku cuma ngikutin konsepnya sendiri: rahmat bagi alam semesta. Menang juara 1, dan emang beneran rahmat, hehe, dapet laptop.',
  }),
  work('sundays', 'Sundays', {
    youtubeVideoId: null,
    category: 'edit',
    role: 'editing',
    summary:
      'Editan ini kubikin sebagai rasa terima kasihku buat teman-temanku atas waktunya selama SMA. Thx for everything. Aeta nara tomo ni warao. 会えたなら共に笑おう.',
  }),
];
