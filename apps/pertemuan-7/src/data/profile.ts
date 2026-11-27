/*
 * SAMPLE DATA — satu-satunya sumber identitas di aplikasi ini.
 * `handle` adalah nama domain/brand situs; nilai lain adalah placeholder eksplisit.
 * Isi dengan data nyata sebelum publikasi, lalu ubah `isSample` menjadi false.
 */
import type { Profile } from '../types';

export const profile: Profile = {
  handle: 'kxrumii',
  name: 'NAMA BELUM DIISI',
  email: 'email-belum-diisi@example.invalid',
  tagline: 'video & motion maker',
  intro:
    'Teks pengenalan contoh. Ganti dengan pengenalan singkat tentang siapa kamu, karya apa yang kamu buat, dan bagaimana kamu bekerja dengan gambar bergerak dan suara.',
  socials: [{ label: 'youtube', url: 'https://youtube.com/@p_ftttt' }],
  isSample: true,
};
