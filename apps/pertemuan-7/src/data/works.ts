/*
 * SAMPLE DATA — semua entri di bawah adalah contoh untuk membangun antarmuka.
 * Ganti dengan karya nyata (judul, tahun, peran, YouTube ID) sebelum publikasi,
 * lalu ubah `isSample` menjadi false. Jangan menebak judul, peran, atau tahun.
 */
import type { Work, WorkCategory } from '../types';

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  film: 'Film',
  'music-video': 'Music Video',
  commercial: 'Commercial',
  social: 'Social',
  experiment: 'Experiment',
};

const SAMPLE_SUMMARY = 'Entri contoh untuk membangun antarmuka. Ganti dengan karya nyata sebelum publikasi.';

export const works: Work[] = [
  {
    slug: 'sample-work-01',
    title: 'Sample Work 01',
    year: null,
    category: 'film',
    role: null,
    summary: SAMPLE_SUMMARY,
    thumbnail: null,
    youtubeVideoId: null,
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
    summary: SAMPLE_SUMMARY,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: null,
    featured: true,
    isSample: true,
  },
  {
    slug: 'sample-work-03',
    title: 'Sample Work 03',
    year: null,
    category: 'commercial',
    role: null,
    summary: SAMPLE_SUMMARY,
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
    summary: SAMPLE_SUMMARY,
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
    summary: SAMPLE_SUMMARY,
    thumbnail: null,
    youtubeVideoId: null,
    externalUrl: null,
    featured: false,
    isSample: true,
  },
];
