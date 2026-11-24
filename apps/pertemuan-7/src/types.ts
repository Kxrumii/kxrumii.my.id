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
  thumbnail: string | null;
  youtubeVideoId: string | null;
  externalUrl: string | null;
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
  focus: string[];
  socials: SocialLink[];
  /** true selama nama, NIM, atau email masih placeholder. */
  isSample: boolean;
}
