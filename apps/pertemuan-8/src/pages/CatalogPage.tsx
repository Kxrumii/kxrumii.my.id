import { Link } from 'react-router';

const sampleBooks = [
  { id: 'clean-code', title: 'Clean Code', author: 'Robert C. Martin' },
  { id: 'designing-data-intensive-applications', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann' },
  { id: 'the-pragmatic-programmer', title: 'The Pragmatic Programmer', author: 'Andrew Hunt & David Thomas' },
];

export function CatalogPage() {
  return (
    <div className="book-grid">
      {sampleBooks.map((book) => (
        <article className="book-card" key={book.id}>
          <p className="eyebrow">{book.author}</p>
          <h2>{book.title}</h2>
          <Link to={book.id}>Lihat detail <span aria-hidden="true">↗</span></Link>
        </article>
      ))}
    </div>
  );
}
