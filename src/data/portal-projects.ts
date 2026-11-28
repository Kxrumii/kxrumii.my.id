export type PortalLanguage = 'id' | 'en';

export interface PortalPreview {
  key: string;
  altId: string;
  altEn: string;
}

export interface PortalProject {
  number: string;
  href: string;
  /** Page id Shared Transition Bridge dari app tujuan. */
  transitionPage: string;
  /** Warna canvas tujuan sampai app itu publikasikan warnanya sendiri. */
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
    title: { id: 'Showreel', en: 'Showreel' },
    category: { id: '[Karya Edit · React]', en: '[Edit Works · React]' },
    previews: [
      { key: 'portfolio-spiral', altId: 'Showreel dalam bentuk spiral', altEn: 'Showreel spiral view' },
      { key: 'portfolio-list', altId: 'Showreel dalam bentuk daftar', altEn: 'Showreel list view' },
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
