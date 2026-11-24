export interface NavItem {
  to: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

/** Shared by the desktop nav and the mobile menu sheet (Huy order: Work, About, Playground, Contact). */
export const navItems: NavItem[] = [
  { to: '/', label: 'Work', isActive: (p) => p === '/' || p.startsWith('/work/') },
  { to: '/about', label: 'About', isActive: (p) => p === '/about' },
  { to: '/playground', label: 'Playground', isActive: (p) => p === '/playground' },
  { to: '/contact', label: 'Contact', isActive: (p) => p === '/contact' },
];

export const trimTrailingSlash = (pathname: string) => pathname.replace(/(.)\/+$/, '$1');

/**
 * Path of the *stage* that owns a URL. The work sheet (`/work/:slug`) is an
 * overlay on the Works stage, so it shares the stage path `/` and opening or
 * closing it must not count as a page change (no scroll reset, no focus move).
 */
export const stagePath = (pathname: string): string => {
  const path = trimTrailingSlash(pathname);
  return path.startsWith('/work/') ? '/' : path;
};
