import { useRef, type MouseEvent } from 'react';
import { playSound } from '../audio/sound';
import { profile } from '../data/profile';
import { CANVAS_PORTAL, PORTAL_HREF, whenTransitionIdle } from '../transition';
import { registerClick } from '../utils/clickStreak';
import { LogoMark } from './LogoMark';
import { TransitionLink } from './TransitionLink';

/**
 * Logo kiri atas. Pas di-hover, name tag miring keluar dengan spring. Klik sekali balik ke beranda; tiga klik
 * cepat balik ke portal tugas, lewat link dokumen tersembunyi biar transisi bridge-nya ikut jalan.
 */
export function Logo() {
  const clicks = useRef<number[]>([]);
  const portalRef = useRef<HTMLAnchorElement>(null);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    playSound('click');
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const streak = registerClick(clicks.current, performance.now());
    clicks.current = streak.clicks;
    if (!streak.reached) return;
    event.preventDefault();
    const { clientX, clientY } = event;
    void whenTransitionIdle().then(() => {
      portalRef.current?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
    });
  };

  return (
    <>
      <TransitionLink
        to="/"
        className="logo"
        aria-label={`${profile.handle} — works`}
        onPointerEnter={() => playSound('hover')}
        onClick={onClick}
      >
        <LogoMark className="logo-mark" />
        <span className="logo-tag" aria-hidden="true">
          <span className="logo-tag-pill">
            {profile.handle}
            <span className="logo-tag-dot" />
          </span>
          <svg className="logo-tag-star" viewBox="0 0 32 32">
            <path d="M16 0l3.2 12.8L32 16l-12.8 3.2L16 32l-3.2-12.8L0 16l12.8-3.2z" fill="currentColor" />
          </svg>
        </span>
      </TransitionLink>
      <a
        ref={portalRef}
        href={PORTAL_HREF}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-transition-link="document"
        data-transition-page="portal"
        data-transition-canvas={CANVAS_PORTAL}
      />
    </>
  );
}
