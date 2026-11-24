import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { notifyRouteCommit, usePageReady } from '../transition';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function SiteLayout() {
  const { key, pathname } = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef<string | null>(null);

  usePageReady(key);

  // Layout effects run during the commit, so awaiting transitions see the new route's DOM.
  useLayoutEffect(() => {
    notifyRouteCommit();
  }, [key]);

  // After a route change, move focus to the content and reset scroll (Back/Forward keeps native scroll restoration).
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (previous === null || previous === pathname) return;
    if (navigationType !== 'POP') window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, navigationType]);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="site-main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
