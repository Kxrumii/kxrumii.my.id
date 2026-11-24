import { useLocation } from 'react-router';
import { transitionIndex } from '../transition';
import { TransitionLink } from './TransitionLink';

interface NavItem {
  to: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Work', isActive: (p) => p === '/' || p.startsWith('/work/') },
  { to: '/playground', label: 'Playground', isActive: (p) => p === '/playground' },
  { to: '/about', label: 'About', isActive: (p) => p === '/about' },
  { to: '/contact', label: 'Contact', isActive: (p) => p === '/contact' },
];

export function SiteHeader() {
  const pathname = useLocation().pathname.replace(/(.)\/+$/, '$1');

  return (
    <header className="site-header" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)}>
      <a
        className="wordmark"
        href="/tugas/"
        data-transition-link="document"
        data-transition-page="portal"
        data-transition-canvas="#0b0b0b"
      >kxrumii<span>.my.id</span></a>
      <nav className="site-nav" aria-label="Navigasi utama">
        {navItems.map((item) => (
          <TransitionLink
            key={item.to}
            to={item.to}
            aria-current={item.isActive(pathname) ? 'page' : undefined}
          >
            {item.label}
          </TransitionLink>
        ))}
      </nav>
    </header>
  );
}
