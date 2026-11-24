import { CATEGORY_LABELS } from '../data/works';
import type { Work } from '../types';
import { cardFace } from '../utils/cardFace';
import { transitionIndex } from '../transition';
import { MetaList } from './MetaList';
import { StatusBadge } from './StatusBadge';

interface WorkInfoProps {
  work: Work | null;
}

function videoLabel(work: Work): string {
  if (work.youtubeVideoId) return 'YouTube';
  if (work.externalUrl) return 'Tautan eksternal';
  return 'Belum tersedia';
}

/**
 * Huy's left-hand metadata for the active work. The inner block is re-keyed
 * per work so it remounts with a blur-to-focus swap (opacity + blur only,
 * none under reduced motion); the box has a fixed size, so swaps never shift
 * the layout.
 */
export function WorkInfo({ work }: WorkInfoProps) {
  return (
    <aside className="work-info" aria-label="Karya aktif" data-transition-exit="" data-transition-enter="" style={transitionIndex(2)}>
      {work ? (
        <div className="work-info-swap" key={work.slug}>
          <p className="ui-label">{CATEGORY_LABELS[work.category]}</p>
          <h2 className="work-info-title">{work.title}</h2>
          <span className="work-info-dash" aria-hidden="true">—</span>
          <p className="work-info-summary">{work.summary}</p>
          <MetaList
            items={[
              { label: 'Peran', value: work.role ?? 'Belum diisi' },
              { label: 'Tahun', value: work.year ?? 'Belum diisi' },
              { label: 'Video', value: videoLabel(work) },
            ]}
          />
          <div className="work-info-foot">
            <ul className="work-swatches" aria-hidden="true">
              {cardFace(work).swatches.map((color, index) => (
                <li key={`${index}-${color}`} style={{ background: color }} />
              ))}
            </ul>
            {work.featured ? <StatusBadge label="Featured" /> : null}
            {work.isSample ? <StatusBadge label="Sample" /> : null}
          </div>
        </div>
      ) : (
        <p className="work-info-empty">Tidak ada karya yang cocok dengan filter.</p>
      )}
    </aside>
  );
}
