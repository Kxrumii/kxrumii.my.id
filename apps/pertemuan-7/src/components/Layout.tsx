import { useCallback, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { notifyRouteCommit, usePageReady } from '../transition';
import { Loader, type GateLeave } from './Loader';
import { Logo } from './Logo';
import { Menu } from './Menu';
import { SoundButton } from './SoundButton';
import { StarField } from './StarField';

export interface LayoutContext {
  /** False while the gate is up: pages stay still. */
  entered: boolean;
  /** The menu panel covers part of the page: the spiral pauses. */
  menuOpen: boolean;
}

/** gate: the intro is up · entering: the logo is flying and the page comes in · entered: normal. */
type Phase = 'gate' | 'entering' | 'entered';

/**
 * App frame: the persistent background canvas, the gate, the fixed chrome (logo, menu, sound) and the routed
 * page. The chrome carries `data-shell`, so same-document transitions move only the page.
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

  // A route change closes the menu and starts the new page at the top (also on browser back/forward). Arriving
  // at the previous work by scrolling up lands at its bottom, so scrolling backwards stays continuous.
  useLayoutEffect(() => {
    setMenuOpen(false);
    const backwards = document.documentElement.dataset.routeDir === 'prev';
    window.scrollTo(0, backwards ? document.documentElement.scrollHeight : 0);
  }, [location.pathname]);

  const entered = phase !== 'gate';
  // On a project the white card has its own close button (as on the reference), so the menu steps aside.
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
