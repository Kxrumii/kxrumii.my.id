/*
 * SAMPLE DATA — semua entri di bawah adalah contoh untuk membangun antarmuka.
 * Ganti dengan karya nyata (judul, tahun, peran, YouTube ID, sampul) sebelum publikasi,
 * lalu ubah `isSample` menjadi false. Jangan menebak judul, peran, atau tahun.
 *
 * Urutan array = urutan di spiral dan list (tidak pernah diacak).
 *  - 01: punya `youtubeVideoId` (video demo publik, hanya untuk menguji pemutar)
 *  - 02: hanya `externalUrl` (tautan contoh `example.com`)
 *  - 03–06: tanpa video dan tanpa tautan (sampul generatif)
 */
import type { Work, WorkCategory } from '../types';

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  film: 'film',
  'music-video': 'music video',
  commercial: 'commercial',
  social: 'social',
  experiment: 'experiment',
};

const sample = (n: number, category: WorkCategory, extra: Partial<Work> = {}): Work => ({
  slug: `sample-work-${String(n).padStart(2, '0')}`,
  title: `Sample Work ${String(n).padStart(2, '0')}`,
  year: null,
  category,
  role: null,
  summary: 'Entri contoh. Ganti dengan ringkasan karya nyata sebelum publikasi.',
  notes: null,
  thumbnail: null,
  youtubeVideoId: null,
  externalUrl: null,
  isSample: true,
  ...extra,
});

export const works: Work[] = [
  sample(1, 'film', {
    summary: 'Entri contoh dengan video demo publik (bukan karya sendiri) untuk menguji pemutar. Ganti dengan karya nyata.',
    notes: 'Catatan produksi contoh. Ganti dengan konteks, alat, atau proses karya yang sebenarnya.',
    youtubeVideoId: 'jNQXAC9IVRw', // SAMPLE: video publik demo, bukan karya pengguna
  }),
  sample(2, 'music-video', {
    summary: 'Entri contoh yang hanya memiliki tautan eksternal, tanpa video yang dapat disematkan.',
    externalUrl: 'https://example.com/', // SAMPLE: domain reserved untuk contoh
  }),
  sample(3, 'commercial'),
  sample(4, 'social'),
  sample(5, 'experiment'),
  sample(6, 'film'),
];
