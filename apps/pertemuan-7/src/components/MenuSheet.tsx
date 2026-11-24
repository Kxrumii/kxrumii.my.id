import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useSound } from '../audio/useSound';
import { profile } from '../data/profile';
import { navItems, trimTrailingSlash } from '../shell/navItems';
import { CopyEmailButton } from './CopyEmailButton';
import { SoundToggle } from './SoundToggle';
import { TransitionLink } from './TransitionLink';

/**
 * Mobile menu (Pacôme's "menu •" pill + sheet) built on a modal <dialog>:
 * the browser handles focus containment and Esc; state mirrors the dialog's
 * own open/close events. The sound toggle is repeated inside because a modal
 * dialog makes everything outside it inert.
 */
export function MenuSheet() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = trimTrailingSlash(useLocation().pathname);
  const { play } = useSound();

  function show() {
    dialogRef.current?.showModal();
    setOpen(true);
    play('open');
  }

  function hide() {
    dialogRef.current?.close();
  }

  // Close when the route changes underneath (e.g. Back while open).
  useEffect(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [pathname]);

  return (
    <>
      <button type="button" className="menu-pill" aria-haspopup="dialog" aria-expanded={open} onClick={show}>
        menu <span className="menu-pill-dot" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="menu-sheet"
        aria-label="Menu"
        onClose={() => {
          setOpen(false);
          play('close');
        }}
      >
        <div className="menu-sheet-top">
          <SoundToggle variant="text" />
          <button type="button" className="menu-close" onClick={hide}>
            tutup <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav aria-label="Navigasi utama (menu)">
          <ul className="menu-sheet-links">
            {navItems.map((item) => (
              <li key={item.to}>
                <TransitionLink
                  to={item.to}
                  aria-current={item.isActive(pathname) ? 'page' : undefined}
                  onClick={() => hide()}
                >
                  {item.label}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="menu-sheet-bottom">
          <CopyEmailButton email={profile.email} label="Email" />
          <ul className="menu-sheet-socials">
            {profile.socials.map((social) => (
              <li key={social.url}>
                <a href={social.url} target="_blank" rel="noopener noreferrer">
                  {social.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
