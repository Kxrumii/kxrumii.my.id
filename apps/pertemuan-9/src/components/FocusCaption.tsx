import { CATEGORY_LABELS } from '../data/works';
import type { Work } from '../types';

interface FocusCaptionProps {
  work: Work | null;
  phase: 'hold' | 'transit';
}

/** Minimal caption for the focused work. Deliberately no number or index: the full index belongs to List mode. */
export function FocusCaption({ work, phase }: FocusCaptionProps) {
  return (
    <p className="showroom-caption" data-phase={phase} aria-live="polite">
      {work ? (
        <>
          <span className="ui-label">{CATEGORY_LABELS[work.category]}</span>
          <span className="showroom-caption-title">{work.title}</span>
        </>
      ) : null}
    </p>
  );
}
