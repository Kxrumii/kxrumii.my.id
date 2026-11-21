import { Link } from 'react-router';

export function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">PAW / PERTEMUAN 08</p>
      <h1>Application architecture.</h1>
      <p className="lead">
        Kerangka React Router untuk menguji client-side routing, nested route,
        dan dynamic route sebelum fitur API dan state management dikembangkan.
      </p>
      <Link className="primary-link" to="/catalog">Buka katalog <span aria-hidden="true">↗</span></Link>
    </section>
  );
}
