import { Link, useParams } from 'react-router';

export function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();

  return (
    <article className="detail-card">
      <p className="eyebrow">DYNAMIC ROUTE / CATALOG / :BOOKID</p>
      <h2>Book detail</h2>
      <p>Parameter ID dari URL: <code>{bookId}</code></p>
      <p className="muted">Data buku akan diambil dari public API pada tahap implementasi Tugas 8.</p>
      <Link to="/catalog">← Kembali ke katalog</Link>
    </article>
  );
}
