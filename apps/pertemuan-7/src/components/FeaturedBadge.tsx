import type { CSSProperties } from 'react';
import { playSound } from '../audio/sound';
import type { Work } from '../types';
import { TransitionLink } from './TransitionLink';
import { WorkCover } from './WorkCover';

const MARQUEE_ITEMS = 12;
/** Rounded rectangle 12 px outside the 280 × 158 card: the path the marquee text travels along. */
const TRACK = 'M30 0H274A30 30 0 0 1 304 30V152A30 30 0 0 1 274 182H30A30 30 0 0 1 0 152V30A30 30 0 0 1 30 0Z';

interface FeaturedBadgeProps {
  work: Work;
  number: string;
}

/**
 * Bottom-left tilted card with a label running around its edge (CSS offset-path). It links to one featured
 * work; the label says so instead of promising a showreel that does not exist yet.
 */
export function FeaturedBadge({ work, number }: FeaturedBadgeProps) {
  return (
    <div className="featured">
      <TransitionLink
        to={`/work/${work.slug}`}
        className="featured-card"
        aria-label={`featured work: ${work.title}`}
        onPointerEnter={() => playSound('hover')}
        onClick={() => playSound('click')}
      >
        <WorkCover work={work} number={number} className="featured-cover" />
        <span className="featured-marquee" aria-hidden="true" style={{ '--track': `path("${TRACK}")` } as CSSProperties}>
          {Array.from({ length: MARQUEE_ITEMS }, (_, i) => (
            <span key={i} className="featured-marquee-text" style={{ '--m': i, '--m-count': MARQUEE_ITEMS } as CSSProperties}>
              featured •
            </span>
          ))}
        </span>
      </TransitionLink>
    </div>
  );
}
