import { useLocation } from 'react-router';
import { useSound } from '../audio/useSound';
import { navItems, trimTrailingSlash } from '../shell/navItems';
import { TransitionLink } from './TransitionLink';

/** Desktop navigation: Huy's "Menu" label over a vertical list of display links. */
export function ShellNav() {
  const pathname = trimTrailingSlash(useLocation().pathname);
  const { play } = useSound();

  return (
    <nav className="shell-nav" aria-label="Navigasi utama">
      <p className="ui-label">Menu</p>
      <ul>
        {navItems.map((item) => {
          const active = item.isActive(pathname);
          return (
            <li key={item.to}>
              <TransitionLink
                className="shell-nav-link"
                to={item.to}
                aria-current={active ? 'page' : undefined}
                onMouseEnter={() => play('hover')}
                onClick={() => play('click')}
              >
                <span className="shell-nav-arrow" aria-hidden="true">→</span>
                {item.label}
              </TransitionLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
