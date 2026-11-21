import { NavLink, Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/">kxrumii<span>.my.id</span></a>
        <nav aria-label="Navigasi aplikasi">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/catalog">Catalog</NavLink>
        </nav>
      </header>
      <main className="content"><Outlet /></main>
      <footer className="site-footer">React Router · Pertemuan 8</footer>
    </div>
  );
}
