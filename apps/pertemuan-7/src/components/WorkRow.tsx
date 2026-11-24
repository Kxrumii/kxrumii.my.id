import { useSound } from '../audio/useSound';
import { CATEGORY_LABELS } from '../data/works';
import type { Work } from '../types';
import { StatusBadge } from './StatusBadge';
import { TransitionLink } from './TransitionLink';

interface WorkRowProps {
  work: Work;
  active: boolean;
  onActivate: (slug: string) => void;
}

/**
 * One entry of the Huy-style list: small grey category, UPPERCASE title, a
 * dash and the one-line summary. The link is the only interactive element;
 * hover and focus make the row active, click or Enter opens the work.
 * `data-work-slug` lets the detail sheet (#6) read this row's rect for FLIP.
 */
export function WorkRow({ work, active, onActivate }: WorkRowProps) {
  const { play } = useSound();

  return (
    <li className="work-row" data-active={active ? 'true' : undefined} data-work-slug={work.slug}>
      <TransitionLink
        className="work-row-link"
        to={`/work/${work.slug}`}
        onMouseEnter={() => {
          onActivate(work.slug);
          play('hover');
        }}
        onFocus={() => onActivate(work.slug)}
        onClick={() => play('click')}
      >
        <span className="work-row-category">{CATEGORY_LABELS[work.category]}</span>
        <span className="work-row-title">{work.title}</span>
        <span className="work-row-dash" aria-hidden="true">—</span>
        <span className="work-row-summary">{work.summary}</span>
        {work.featured || work.isSample ? (
          <span className="work-row-flags">
            {work.featured ? <StatusBadge label="Featured" /> : null}
            {work.isSample ? <StatusBadge label="Sample" /> : null}
          </span>
        ) : null}
      </TransitionLink>
    </li>
  );
}
