import { CATEGORY_LABELS } from '../data/works';
import type { Work } from '../types';
import { MetaList } from './MetaList';

interface WorkPreviewProps {
  work: Work;
}

/**
 * Preview of the active work. The inner block is re-keyed per work so it
 * remounts and plays a blur-to-focus swap (opacity + blur only, so nothing
 * moves; disabled under prefers-reduced-motion in CSS). The container has a
 * fixed height, so changing the active item never shifts the layout.
 */
export function WorkPreview({ work }: WorkPreviewProps) {
  return (
    <aside className="work-preview" aria-label="Pratinjau karya aktif">
      <div className="work-preview-swap" key={work.slug}>
        <p className="eyebrow">{CATEGORY_LABELS[work.category]}</p>
        <h2 className="work-preview-title">{work.title}</h2>
        <p className="work-preview-summary">{work.summary}</p>
        <MetaList
          items={[
            { label: 'Tahun', value: work.year ?? 'Belum diisi' },
            { label: 'Peran', value: work.role ?? 'Belum diisi' },
          ]}
        />
      </div>
    </aside>
  );
}
