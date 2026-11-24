import { DisclosurePanel } from '../components/DisclosurePanel';
import { StatusBadge } from '../components/StatusBadge';
import { Stage } from '../components/Stage';
import { useSound } from '../audio/useSound';
import { KIND_LABELS, playgroundItems } from '../data/playground';
import { cardFace, haloFor } from '../utils/cardFace';

/** Experiments as an editorial grid: generative card faces, notes behind a disclosure. */
export function PlaygroundPage() {
  const { play } = useSound();

  return (
    <Stage name="playground" title="Playground" eyebrow="PLAYGROUND">
      <p className="stage-lead">Eksperimen visual, tes editing, dan potongan proses yang belum menjadi karya final.</p>
      <ul className="play-grid" aria-label="Daftar eksperimen">
        {playgroundItems.map((item, index) => {
          // Experiments have no thumbnail yet; the face comes from the id, like the orbit cards.
          const face = cardFace({ slug: item.id, thumbnail: null });
          return (
            <li key={item.id} className="play-card" onMouseEnter={() => play('hover')}>
              <div className="play-face" style={{ background: face.background, color: face.ink }} aria-hidden="true">
                <span className="play-face-index" style={{ color: face.inks.top, textShadow: haloFor(face.inks.top) }}>{String(index + 1).padStart(2, '0')}</span>
                <span className="play-face-kind" style={{ color: face.inks.bottom, textShadow: haloFor(face.inks.bottom) }}>{KIND_LABELS[item.kind]}</span>
              </div>
              <h2 className="play-title">{item.title}</h2>
              <p className="badge-row">
                <StatusBadge label={KIND_LABELS[item.kind]} />
                {item.isSample ? <StatusBadge label="Sample" /> : null}
              </p>
              <DisclosurePanel title="Catatan eksperimen" onToggle={(open) => play(open ? 'open' : 'close')}>
                <p className="page-copy">{item.note}</p>
              </DisclosurePanel>
            </li>
          );
        })}
      </ul>
    </Stage>
  );
}
