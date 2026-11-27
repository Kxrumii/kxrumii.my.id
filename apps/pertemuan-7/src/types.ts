/** The owner's own terms, taken from the work titles ("[Mograph]", "Edit/AMV"). */
export type WorkCategory = 'edit' | 'mograph';

export interface Work {
  slug: string;
  title: string;
  /** null = belum diisi; jangan menebak tahun karya. */
  year: number | null;
  /** null = jenis karya belum disebut owner. */
  category: WorkCategory | null;
  /** null = peran belum dikonfirmasi; hanya isi sesuai kontribusi nyata. */
  role: string | null;
  /** Deskripsi singkat; null = belum ditulis (tampil "deskripsi menyusul"). */
  summary: string | null;
  /** Catatan produksi di halaman proyek; null = belum ditulis. */
  notes: string | null;
  /** Sampul di folder public app, mis. `works/<slug>/cover.webp`; null = sampul generatif. */
  cover: string | null;
  /** Styleframes di folder public app; juga dipakai sebagai thumbnail scrubber player. */
  styleframes: string[];
  /** Rasio tampilan video (lebar / tinggi), hasil ffprobe file asli. */
  aspect: number;
  /** Ada loop preview bisu (`<slug>.mp4`): dev dari local-media/previews, prod dari media/previews. */
  preview: boolean;
  /** null = video belum ada di YouTube (tampil "video segera hadir"). */
  youtubeVideoId: string | null;
  externalUrl: string | null;
  /** true selama entri masih data contoh dan belum diganti karya nyata. */
  isSample: boolean;
}

export type SocialIconName = 'github' | 'instagram' | 'tiktok' | 'youtube';

export interface SocialLink {
  /** Network name, e.g. "GitHub". */
  label: string;
  url: string;
  icon: SocialIconName;
  /** Handle shown under the icon on hover. */
  handle: string;
}

export interface Profile {
  /** Nama tampilan / handle publik. */
  handle: string;
  name: string;
  /** null = kontak tidak ditampilkan. */
  email: string | null;
  /** Satu baris di loader dan footer, mis. "video & motion maker". */
  tagline: string;
  /** Paragraf besar di halaman About. */
  intro: string;
  /** Kutipan kecil di bawah pernyataan About; null = tidak ada. */
  quote: string | null;
  socials: SocialLink[];
  /** true selama nama, email, atau bio masih placeholder. */
  isSample: boolean;
}
