/*
 * SAMPLE DATA — satu-satunya sumber nama, NIM, dan email.
 * Nilai di bawah adalah placeholder eksplisit; isi dengan data nyata sebelum
 * publikasi, lalu ubah `isSample` menjadi false. Jangan menebak NIM.
 */
import type { Profile } from '../types';

export const profile: Profile = {
  name: 'NAMA BELUM DIISI',
  nim: 'BELUM DIISI',
  email: 'email-belum-diisi@example.invalid',
  tagline: 'Karya video dan eksplorasi visual.',
  intro: 'Teks pengenalan contoh. Ganti dengan pengenalan singkat tentang fokus kreatif.',
  role: null,
  tools: [],
  availability: 'Informasi ketersediaan belum diisi.',
  focus: ['Videografi', 'Editing', 'Karya kreatif'],
  socials: [{ label: 'YouTube', url: 'https://youtube.com/@p_ftttt' }],
  isSample: true,
};
