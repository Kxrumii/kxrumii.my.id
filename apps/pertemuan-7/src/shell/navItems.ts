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
