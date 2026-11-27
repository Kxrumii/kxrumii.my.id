/*
 * SAMPLE DATA — semua entri di bawah adalah contoh untuk membangun antarmuka.
 * Ganti dengan karya nyata (judul, tahun, peran, YouTube ID) sebelum publikasi,
 * lalu ubah `isSample` menjadi false. Jangan menebak judul, peran, atau tahun.
 *
 * Cakupan sampel (agar setiap cabang UI dapat diuji):
 *  - 01: punya `youtubeVideoId` (video demo publik, hanya untuk menguji pemutar)
 *  - 02: hanya `externalUrl` (tautan contoh `example.com`)
 *  - 03–05: tanpa video dan tanpa tautan (fallback "video belum tersedia")
 */
import type { Work, WorkCategory } from '../types';

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  film: 'Film',
  'music-video': 'Music Video',
  commercial: 'Commercial',
  social: 'Social',
  experiment: 'Experiment',
};

export const works: Work[] = [
  {
    slug: 'sample-work-01',
    title: 'Sample Work 01',
    year: null,
    category: 'film',
    role: null,
    summary: 'Entri contoh dengan video demo publik (bukan karya sendiri) untuk menguji pemutar. Ganti dengan karya nyata.',
    notes: 'Catatan produksi contoh. Ganti dengan konteks, alat, atau proses karya yang sebenarnya.',
    thumbnail: null,
    youtubeVideoId: 'jNQXAC9IVRw', // SAMPLE: video publik demo, bukan karya pengguna
    externalUrl: null,
    featured: true,
    isSample: true,
  },
  {
    slug: 'sample-work-02',
    title: 'Sample Work 02',
    year: null,
    category: 'music-video',
    role: null,
    summary: 'Entri contoh yang hanya memiliki tautan eksternal, tanpa video yang dapat disematkan.',
    notes: null,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: 'https://example.com/', // SAMPLE: domain reserved untuk contoh
    featured: true,
    isSample: true,
  },
  {
    slug: 'sample-work-03',
    title: 'Sample Work 03',
    year: null,
    category: 'commercial',
    role: null,
    summary: 'Entri contoh tanpa video dan tanpa tautan. Ganti dengan karya nyata sebelum publikasi.',
    notes: null,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: null,
    featured: false,
    isSample: true,
  },
  {
    slug: 'sample-work-04',
    title: 'Sample Work 04',
    year: null,
    category: 'social',
    role: null,
    summary: 'Entri contoh untuk karya media sosial. Ganti dengan karya nyata sebelum publikasi.',
    notes: null,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: null,
    featured: false,
    isSample: true,
  },
  {
    slug: 'sample-work-05',
    title: 'Sample Work 05',
    year: null,
    category: 'experiment',
    role: null,
    summary: 'Entri contoh untuk karya eksperimen. Ganti dengan karya nyata sebelum publikasi.',
    notes: null,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: null,
    featured: false,
    isSample: true,
  },
];
