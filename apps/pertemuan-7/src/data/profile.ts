/*
 * Identitas Fahrii. Handle, tagline, tautan sosial, dan intro dikonfirmasi owner; nama dari Pertemuan 1.
 * Email sengaja tidak dicantumkan (kontak tidak ditampilkan).
 */
import type { Profile } from '../types';

export const profile: Profile = {
  handle: 'Fahrii',
  name: 'Fahri Khairun Ariansyah',
  email: null,
  tagline: 'developer & editor',
  intro:
    'Halo, aku Fahri. Aku kuliah Teknik Informatika di UIN Sunan Gunung Djati Bandung, jadi ya deket sama logika dan baris kode. Tapi di luar itu aku terobsesi sama cerita, makanya sering ngulik visual buat bercerita: motion graphic, edit dan AMV, compositing di After Effects, sampai nyoba 3D di Blender. Buatku ngoding sama ngedit itu satu benang merah. Kode yang nyusun kerangkanya, visual yang ngehidupin ceritanya.',
  quote: 'People can only save themselves. One person saving another is impossible.',
  socials: [
    { label: 'GitHub', url: 'https://github.com/kxrumii', icon: 'github', handle: 'Kxrumii' },
    { label: 'Instagram', url: 'https://instagram.com/p_ftttt', icon: 'instagram', handle: 'p_ftttt' },
    { label: 'TikTok', url: 'https://tiktok.com/@p_ftttt', icon: 'tiktok', handle: 'p_ftttt' },
    { label: 'YouTube', url: 'https://www.youtube.com/@p_ftttt', icon: 'youtube', handle: 'p_ftttt' },
  ],
  isSample: false,
};
