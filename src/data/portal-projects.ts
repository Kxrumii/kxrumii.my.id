export type PortalLanguage = 'id' | 'en';

export interface PortalPreview {
  key: string;
  altId: string;
  altEn: string;
}

export interface PortalProject {
  number: string;
  href: string;
  title: Record<PortalLanguage, string>;
  category: Record<PortalLanguage, string>;
  previews: [PortalPreview, PortalPreview];
}

export const portalProjects: PortalProject[] = [
  {
    number: '01',
    href: '/tugas/pertemuan-1/',
    title: { id: 'Profil', en: 'Profile' },
    category: { id: '[HTML5]', en: '[HTML5]' },
    previews: [
      { key: 'profile-home', altId: 'Tampilan utama profil', altEn: 'Profile homepage preview' },
      { key: 'profile-details', altId: 'Bagian biodata dan detail', altEn: 'Profile details preview' },
    ],
  },
  {
    number: '06',
    href: '/tugas/pertemuan-6/',
    title: { id: 'Task Manager', en: 'Task Manager' },
    category: { id: '[TypeScript · Vite]', en: '[TypeScript · Vite]' },
    previews: [
      { key: 'task-list', altId: 'Daftar tugas', altEn: 'Task list preview' },
      { key: 'task-form', altId: 'Form tambah atau edit tugas', altEn: 'Task form preview' },
    ],
  },
  {
    number: '07',
    href: '/tugas/pertemuan-7/',
    title: { id: 'Portofolio', en: 'Portfolio' },
    category: { id: '[Karya Kreatif · React]', en: '[Creative Work · React]' },
    previews: [
      { key: 'portfolio-work', altId: 'Halaman karya terpilih', altEn: 'Selected works page preview' },
      { key: 'portfolio-playground', altId: 'Halaman playground', altEn: 'Playground page preview' },
    ],
  },
  {
    number: '08',
    href: '/tugas/pertemuan-8/',
    title: { id: 'Arsip Musik', en: 'Music Archive' },
    category: { id: '[Vinyl · React Router]', en: '[Vinyl · React Router]' },
    previews: [
      { key: 'music-archive', altId: 'Halaman arsip musik', altEn: 'Music archive page preview' },
      { key: 'music-release', altId: 'Detail album dan vinyl', altEn: 'Album and vinyl detail preview' },
    ],
  },
];
