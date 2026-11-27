export type PortalLanguage = 'id' | 'en';

export interface PortalPreview {
  key: string;
  altId: string;
  altEn: string;
}

export interface PortalProject {
  number: string;
  href: string;
  /** Shared Transition Bridge page id of the destination app. */
  transitionPage: string;
  /** Destination canvas colour used until that app has published its own. */
  canvasFallback: string;
  title: Record<PortalLanguage, string>;
  category: Record<PortalLanguage, string>;
  previews: [PortalPreview, PortalPreview];
}

export const portalProjects: PortalProject[] = [
  {
    number: '01',
    href: '/tugas/pertemuan-1/',
    transitionPage: 'task-1',
    canvasFallback: '#eff1f5',
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
    transitionPage: 'task-6',
    canvasFallback: '#10110f',
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
    transitionPage: 'task-7',
    canvasFallback: '#0a0a0a',
    title: { id: 'Portofolio', en: 'Portfolio' },
    category: { id: '[Karya Kreatif · React]', en: '[Creative Work · React]' },
    previews: [
      { key: 'portfolio-spiral', altId: 'Galeri spiral karya', altEn: 'Spiral works gallery preview' },
      { key: 'portfolio-list', altId: 'Daftar karya', altEn: 'Works list preview' },
    ],
  },
  {
    number: '08',
    href: '/tugas/pertemuan-8/',
    transitionPage: 'task-8',
    canvasFallback: '#10110f',
    title: { id: 'Arsip Musik', en: 'Music Archive' },
    category: { id: '[Vinyl · React Router]', en: '[Vinyl · React Router]' },
    previews: [
      { key: 'music-archive', altId: 'Halaman arsip musik', altEn: 'Music archive page preview' },
      { key: 'music-release', altId: 'Detail album dan vinyl', altEn: 'Album and vinyl detail preview' },
    ],
  },
];
