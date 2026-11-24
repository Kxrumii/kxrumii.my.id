import { Stage } from '../components/Stage';
import { TransitionLink } from '../components/TransitionLink';

export function NotFoundPage() {
  return (
    <Stage name="not-found" title="Halaman tidak ditemukan" eyebrow="404">
      <p className="page-copy">Alamat yang dibuka tidak ada di portfolio ini.</p>
      <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
    </Stage>
  );
}
