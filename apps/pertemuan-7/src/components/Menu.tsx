import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { playSound } from '../audio/sound';
import { profile } from '../data/profile';
import { Letters } from './PillButton';
import { SocialLinks } from './SocialLinks';
import { TransitionLink } from './TransitionLink';

interface MenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LINKS = [
  { to: '/', label: 'works' },
  { to: '/about', label: 'about' },
] as const;

/**
 * Menu kanan atas: pill putih "menu" yang membesar (spring) jadi panel putih tinggi berisi link besar, tombol
 * sosial bulat, dan credit; tombol bulat gelap buat nutup. Escape dan klik di luar menutup, fokus pindah ke
 * panel pas buka dan balik ke toggle pas tutup.
 */
export function Menu({ open, onOpenChange }: MenuProps) {
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) firstLinkRef.current?.focus({ preventScroll: true });
    else if (wasOpen.current) toggleRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        playSound('close');
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const setOpen = (next: boolean) => {
    playSound(next ? 'open' : 'close');
    onOpenChange(next);
  };

  const state = open ? 'opened' : 'closed';

  return (
    <>
      <button type="button" className={`menu-backdrop ${state}`} tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} />
      <div className={`menu ${state}`}>
        <div className="menu-surface" aria-hidden="true" />
        <button
          ref={toggleRef}
          type="button"
          className={`menu-toggle ${state}`}
          aria-expanded={open}
          aria-controls="site-menu"
          tabIndex={open ? -1 : 0}
          onPointerEnter={() => playSound('hover')}
          onClick={() => setOpen(true)}
        >
          <Letters text="menu" />
        </button>
        <button
          type="button"
          className={`menu-close ${state}`}
          aria-label="close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <nav id="site-menu" className={`menu-content ${state}`} aria-label="Main" inert={!open}>
          <ul className="menu-links">
            {LINKS.map((link, index) => {
              const current = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
              return (
                <li key={link.to}>
                  <TransitionLink
                    ref={index === 0 ? firstLinkRef : undefined}
                    to={link.to}
                    className="menu-link"
                    aria-current={current ? 'page' : undefined}
                    onPointerEnter={() => playSound('hover')}
                    onClick={() => {
                      playSound('click');
                      onOpenChange(false);
                    }}
                  >
                    {link.label}
                  </TransitionLink>
                </li>
              );
            })}
            {profile.email ? (
              <li>
                <a className="menu-link" href={`mailto:${profile.email}`} onPointerEnter={() => playSound('hover')}>
                  contact
                </a>
              </li>
            ) : null}
          </ul>
          <div className="menu-footer">
            <SocialLinks links={profile.socials} variant="round" />
            <p className="menu-credits">design &amp; development {profile.handle}</p>
          </div>
        </nav>
      </div>
    </>
  );
}
