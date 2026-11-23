import { NavLink, Outlet } from 'react-router';
import { transitionIndex, usePageReady } from '../transition';

export function RootLayout() {
  // RootLayout is the persistent application shell; it commits on the first render.
  usePageReady();

  return (
    <div className="app-shell">
      <header className="site-header" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)}>
        <a
          className="wordmark"
          href="/tugas/"
          data-transition-link="document"
          data-transition-page="portal"
          data-transition-canvas="#0b0b0b"
        >kxrumii<span>.my.id</span></a>
        <nav aria-label="Navigasi aplikasi">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/catalog">Catalog</NavLink>
        </nav>
      </header>
      <main className="content" data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
        <Outlet />
      </main>
      <footer className="site-footer" data-transition-exit="" data-transition-enter="" style={transitionIndex(2)}>
        React Router · Pertemuan 8
      </footer>
    </div>
  );
}
