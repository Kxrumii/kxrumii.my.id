import { Page } from '../components/Page';
import { TransitionLink } from '../components/TransitionLink';

export function NotFoundPage() {
  return (
    <Page name="not-found" title="Halaman tidak ditemukan" eyebrow="404">
      <p className="page-copy">Alamat yang dibuka tidak ada di portfolio ini.</p>
      <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
    </Page>
  );
}
