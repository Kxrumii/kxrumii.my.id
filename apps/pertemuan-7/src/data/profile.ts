/*
 * Identitas di aplikasi ini. `handle`, `tagline`, dan `socials` sudah dikonfirmasi owner (socials sama dengan footer
 * Pertemuan 1). `name`, `email`, dan `intro` masih placeholder; isi lalu ubah `isSample` menjadi false.
 */
import type { Profile } from '../types';

export const profile: Profile = {
  handle: 'Fahrii',
  name: 'NAMA BELUM DIISI',
  email: 'email-belum-diisi@example.invalid',
  tagline: 'developer & editor',
  intro:
    'Teks pengenalan contoh. Ganti dengan pengenalan singkat tentang siapa kamu, karya apa yang kamu buat, dan bagaimana kamu bekerja dengan kode, gambar bergerak, dan suara.',
  socials: [
    { label: 'GitHub', url: 'https://github.com/kxrumii', icon: 'github', handle: 'Kxrumii' },
    { label: 'Instagram', url: 'https://instagram.com/p_ftttt', icon: 'instagram', handle: 'p_ftttt' },
    { label: 'TikTok', url: 'https://tiktok.com/@p_ftttt', icon: 'tiktok', handle: 'p_ftttt' },
    { label: 'YouTube', url: 'https://youtube.com/@Kxrumi1', icon: 'youtube', handle: 'Kxrumi1' },
  ],
  isSample: true,
};
