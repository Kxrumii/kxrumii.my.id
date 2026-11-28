import { useCallback, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { notifyRouteCommit, usePageReady } from '../transition';
import { Loader, type GateLeave } from './Loader';
import { Logo } from './Logo';
import { Menu } from './Menu';
import { SoundButton } from './SoundButton';
import { StarField } from './StarField';

export interface LayoutContext {
  /** false selama gate masih tampil: halaman diam dulu. */
  entered: boolean;
  /** Panel menu nutupin sebagian halaman, jadi spiral di-pause. */
  menuOpen: boolean;
}

/** gate: intro tampil · entering: logo terbang dan halaman masuk · entered: normal. */
type Phase = 'gate' | 'entering' | 'entered';

/**
 * Frame app: canvas background yang persisten, gate, chrome tetap (logo, menu, sound), dan halaman dari router.
 * Chrome punya `data-shell`, jadi transisi same-document cuma menggerakkan halamannya.
 */
export function Layout() {
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('gate');
  const [origin, setOrigin] = useState<GateLeave['origin'] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLeave = useCallback((leave: GateLeave) => {
    setOrigin(leave.origin);
    setPhase('entering');
  }, []);
  const handleEntered = useCallback(() => setPhase('entered'), []);

  useLayoutEffect(() => {
    notifyRouteCommit();
  }, [location.pathname]);
  usePageReady(location.pathname);

  // Ganti route: menu nutup dan halaman baru mulai dari atas (termasuk pas back/forward). Kalau ke karya
  // sebelumnya lewat scroll ke atas, mendarat di bawahnya biar scroll mundur tetap nyambung.
  useLayoutEffect(() => {
    setMenuOpen(false);
    const backwards = document.documentElement.dataset.routeDir === 'prev';
    window.scrollTo(0, backwards ? document.documentElement.scrollHeight : 0);
  }, [location.pathname]);

  const entered = phase !== 'gate';
  // Di halaman project, kartu putihnya punya tombol close sendiri (kayak referensi), jadi menu minggir.
  const onProject = location.pathname.startsWith('/work/');
  const context: LayoutContext = { entered, menuOpen };

  return (
    <>
      <StarField starsOn={entered} origin={origin} />
      {phase !== 'entered' ? <Loader onLeave={handleLeave} onEntered={handleEntered} /> : null}
      <div className="chrome" data-shell data-phase={phase} data-route={onProject ? 'project' : 'default'} inert={!entered}>
        <Logo />
        <Menu open={menuOpen} onOpenChange={setMenuOpen} />
        <SoundButton />
      </div>
      <main className="page" key={location.pathname} inert={!entered || menuOpen} data-phase={phase}>
        <Outlet context={context} />
      </main>
    </>
  );
}
