import { useCallback, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { works } from '../data/works';
import { notifyRouteCommit, usePageReady } from '../transition';
import { workNumber } from '../utils/works';
import { FeaturedBadge } from './FeaturedBadge';
import { Loader } from './Loader';
import { Logo } from './Logo';
import { Menu } from './Menu';
import { SoundButton } from './SoundButton';

export interface LayoutContext {
  /** False while the intro loader is up: pages stay still and silent. */
  entered: boolean;
  /** The menu panel covers part of the page: the spiral pauses. */
  menuOpen: boolean;
}

/**
 * App frame: the intro loader, the fixed chrome (logo, menu, featured card, sound) and the routed page.
 * The chrome carries `data-shell`, so same-document transitions move only the page.
 */
export function Layout() {
  const location = useLocation();
  const [entered, setEntered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleEntered = useCallback(() => setEntered(true), []);

  useLayoutEffect(() => {
    notifyRouteCommit();
  }, [location.pathname]);
  usePageReady(location.pathname);

  // A route change closes the menu and starts the new page at the top (also on browser back/forward).
  useLayoutEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const featured = works[0];
  const showFeatured = featured && !location.pathname.startsWith('/work/');
  const context: LayoutContext = { entered, menuOpen };

  return (
    <>
      {!entered ? <Loader onEntered={handleEntered} /> : null}
      <div className="chrome" data-shell inert={!entered}>
        <Logo />
        <Menu open={menuOpen} onOpenChange={setMenuOpen} />
        {showFeatured ? <FeaturedBadge work={featured} number={workNumber(0)} /> : null}
        <SoundButton />
      </div>
      <main className="page" key={location.pathname} inert={!entered || menuOpen} data-entered={entered}>
        <Outlet context={context} />
      </main>
    </>
  );
}
