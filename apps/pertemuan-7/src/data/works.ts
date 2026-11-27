/*
 * Karya Fahrii. Judul diambil dari judul YouTube / nama file owner (dengan koreksi owner).
 *
 * Detail (kategori, tahun, peran, deskripsi, catatan) masih DRAFT: disusun dari judul YouTube, frame videonya, dan
 * thumbnail, lalu dikoreksi owner. Yang tidak ada buktinya dibiarkan null (tampil "—"), misalnya tahun upload yang
 * tidak tercantum di mana pun. Urutan array = urutan di spiral dan list.
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
  film: 'film',
};

/** Label kategori, atau "—" bila belum disebut. */
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
}

const work = (slug: string, title: string, details: WorkDetails): Work => {
  const { youtubeVideoId, category, year = null, role = null, summary = null, notes = null, aspect = 16 / 9, frames = 3 } = details;
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
    preview: true,
    youtubeVideoId,
    externalUrl: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null,
    isSample: false,
  };
};

export const works: Work[] = [
  // Aspect ratios measured with ffprobe on the owner's files (2480×2160, 1440×1080); the rest are 16:9.
  work('last-friday-night', 'Last Friday Night', {
    youtubeVideoId: 'X7lZLkjGXXk',
    category: 'mograph',
    role: 'motion graphic',
    aspect: 2480 / 2160,
    summary:
      'Kinetic typography buat lagu Last Friday Night. Liriknya aku pecah jadi blok-blok huruf tebal yang loncat, miring, dan numpuk di atas warna-warna nabrak, biar rasanya kayak pesta yang makin lama makin kacau.',
    notes: 'Dikerjain di Alight Motion, dan presetnya aku bagiin gratis.',
  }),
  work('a-signal-from-outer-space', 'A Signal From Outer Space', {
    youtubeVideoId: 'talzLiLx1fc',
    category: 'mograph',
    year: 2024,
    role: 'motion graphic',
    summary:
      'Motion graphic bertema luar angkasa: planet ungu yang muter di orbit, bintang, dan sinyal kecil yang bergerak ngikutin musik. Semua bentuknya flat dan sederhana, yang aku mainin lebih ke ritme geraknya.',
    notes: 'Dibuat di Alight Motion, presetnya juga aku bagiin gratis. Tanggal di thumbnail-nya 7 Desember 2024.',
  }),
  work('love-letter-from-violet-evergarden', 'Love Letter From Violet Evergarden', {
    youtubeVideoId: 'SVuNZH-vqMg',
    category: 'edit',
    role: 'editing',
    summary:
      'Edit Violet Evergarden yang pelan dan hangat. Mulai dari mesin tik, lanjut ke wajah-wajah yang lagi nunggu surat, terus ditutup sama Violet sendiri. Aku pengin rasanya kayak baca surat, bukan nonton trailer.',
  }),
  work('oregairu-cinta-terbaik', 'Oregairu — Cinta Terbaik', {
    youtubeVideoId: 'qYnPTRtK7Xk',
    category: 'edit',
    role: 'editing',
    summary:
      'AMV Oregairu pakai lagu Cinta Terbaik. Isinya potongan adegan yang dibingkai kayak foto polaroid dan rol film, ditambah teks lirik yang muncul di sela-sela langit dan awan.',
  }),
  work('sousou-no-frieren-new-tank', 'Sousou no Frieren — New Tank', {
    youtubeVideoId: '6ZdKTaC54z8',
    category: 'edit',
    role: 'editing',
    aspect: 4 / 3,
    summary:
      'Edit Frieren yang cepat dan agresif, ngikutin lagu New Tank. Banyak kilatan cahaya biru dan pink, efek energi, dan potongan aksi yang dipotong pas di ketukan.',
    notes: 'Project file-nya aku bagiin gratis, siapa tahu ada yang mau belajar dari situ.',
  }),
  work('ilusi-garis-kemiskinan', 'ILUSI GARIS KEMISKINAN', {
    youtubeVideoId: null,
    category: 'film',
    summary:
      'Video penjelasan soal garis kemiskinan, yang dari judulnya aja udah ngajak nanya: angka itu beneran nunjukin kondisi orang, atau cuma ilusi? Datanya dibawain lewat motion graphic flat (gunung, diagram batang), diselingi obrolan dua narasumber dengan gaya rekaman kamera VHS.',
  }),
  work('rahmatan-lil-alamin', 'Rahmatan Lil Alamin', {
    youtubeVideoId: null,
    category: 'film',
    summary:
      'Film pendek live action yang diambil di ruang-ruang sehari-hari: kamar, layar laptop, langkah kaki, pintu yang kebuka, dengan tekstur halftone di beberapa adegan. Judulnya diambil dari "rahmatan lil alamin", rahmat bagi semesta alam.',
  }),
  work('sundays', 'Sundays', {
    youtubeVideoId: null,
    category: 'mograph',
    role: 'editing & motion graphic',
    summary:
      'Edit vertikal dari foto-foto naik gunung dan kemah bareng teman. Fotonya aku susun jadi kolase, ditimpa kinetic typography warna pink, dan ditutup tulisan "thx 4 everything".',
    notes: 'Semacam ucapan terima kasih buat orang-orang di foto itu.',
  }),
];
