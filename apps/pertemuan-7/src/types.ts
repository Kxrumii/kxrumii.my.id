export type WorkCategory = 'film' | 'music-video' | 'commercial' | 'social' | 'experiment';

export interface Work {
  slug: string;
  title: string;
  /** null = belum diisi; jangan menebak tahun karya. */
  year: number | null;
  category: WorkCategory;
  /** null = peran belum dikonfirmasi; hanya isi sesuai kontribusi nyata. */
  role: string | null;
  summary: string;
  /** Catatan produksi di halaman proyek; null = belum ditulis. */
  notes: string | null;
  /** URL gambar sampul milik sendiri; null = pakai thumbnail YouTube atau sampul generatif. */
  thumbnail: string | null;
  youtubeVideoId: string | null;
  externalUrl: string | null;
  /** true selama entri masih data contoh dan belum diganti karya nyata. */
  isSample: boolean;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface Profile {
  /** Nama tampilan / handle publik. */
  handle: string;
  name: string;
  email: string;
  /** Satu baris di loader dan footer, mis. "video & motion maker". */
  tagline: string;
  /** Paragraf besar di halaman About. */
  intro: string;
  socials: SocialLink[];
  /** true selama nama, email, atau bio masih placeholder. */
  isSample: boolean;
}
