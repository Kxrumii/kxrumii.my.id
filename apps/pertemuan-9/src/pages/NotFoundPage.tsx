import { useSound } from '../audio/useSound';
import { Stage } from '../components/Stage';
import { TransitionLink } from '../components/TransitionLink';

export function NotFoundPage() {
  const { play } = useSound();

  return (
    <Stage name="not-found" title="Halaman tidak ditemukan" eyebrow="404">
      <p className="notfound-numeral" aria-hidden="true">404</p>
      <p className="stage-lead">Alamat yang dibuka tidak ada di portfolio ini.</p>
      <TransitionLink className="text-link" to="/" onClick={() => play('click')}>
        ← Kembali ke Work
      </TransitionLink>
    </Stage>
  );
}
