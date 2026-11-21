import { Outlet } from 'react-router';

export function CatalogLayout() {
  return (
    <section>
      <p className="eyebrow">NESTED ROUTE / CATALOG</p>
      <h1>Book catalog.</h1>
      <Outlet />
    </section>
  );
}
