import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="detail-card">
      <p className="eyebrow">404 / NOT FOUND</p>
      <h1>Halaman tidak ditemukan.</h1>
      <Link to="/">Kembali ke overview</Link>
    </section>
  );
}
