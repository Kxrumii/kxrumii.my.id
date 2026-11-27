export type WorkCategory = 'film' | 'music-video' | 'commercial' | 'social' | 'experiment';

/** Filter value of the Work index: one category, or every category. */
export type CategoryFilter = WorkCategory | 'all';

export interface Work {
  slug: string;
  title: string;
  /** null = belum diisi; jangan menebak tahun karya. */
  year: number | null;
  category: WorkCategory;
  /** null = peran belum dikonfirmasi; hanya isi sesuai kontribusi nyata. */
  role: string | null;
  summary: string;
  /** Production notes shown in the detail page's collapsible panel; null = not written yet. */
  notes: string | null;
  thumbnail: string | null;
  youtubeVideoId: string | null;
  externalUrl: string | null;
  /** Lebar / tinggi media asli; null/kosong = belum diketahui (Gallery memakai 16:9 sementara). Jangan menebak. */
  aspectRatio?: number | null;
  featured: boolean;
  /** true selama entri masih data contoh dan belum diganti karya nyata. */
  isSample: boolean;
}

export type PlaygroundKind = 'edit-test' | 'process' | 'concept' | 'motion';

export interface PlaygroundItem {
  id: string;
  title: string;
  kind: PlaygroundKind;
  note: string;
  isSample: boolean;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  nim: string;
  email: string;
  tagline: string;
  intro: string;
  /** null = belum diisi; hanya isi sesuai peran nyata. */
  role: string | null;
  /** Perangkat / software yang benar-benar dipakai; kosong = belum diisi. */
  tools: string[];
  availability: string;
  focus: string[];
  socials: SocialLink[];
  /** true selama nama, NIM, atau email masih placeholder. */
  isSample: boolean;
}
