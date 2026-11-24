import { CATEGORY_LABELS } from '../data/works';
import type { Work } from '../types';
import { StatusBadge } from './StatusBadge';
import { TransitionLink } from './TransitionLink';

interface WorkRowProps {
  work: Work;
  /** 1-based position in the currently visible list. */
  position: number;
  active: boolean;
  onActivate: (slug: string) => void;
}

/**
 * One row of the work index. The only interactive element is the link itself
 * (no nested buttons/links): hover and focus make the row active, click or
 * Enter opens the detail page.
 */
export function WorkRow({ work, position, active, onActivate }: WorkRowProps) {
  return (
    <li className="work-row" data-active={active ? 'true' : undefined}>
      <TransitionLink
        className="work-row-link"
        to={`/work/${work.slug}`}
        onMouseEnter={() => onActivate(work.slug)}
        onFocus={() => onActivate(work.slug)}
      >
        <span className="work-row-index">{String(position).padStart(2, '0')}</span>
        <span className="work-row-title">{work.title}</span>
        <span className="work-row-flags">
          {work.featured ? <StatusBadge label="Featured" /> : null}
          {work.isSample ? <StatusBadge label="Sample" /> : null}
        </span>
        <span className="work-row-meta">{CATEGORY_LABELS[work.category]}</span>
        <span className="work-row-meta">{work.year ?? '—'}</span>
      </TransitionLink>
    </li>
  );
}
