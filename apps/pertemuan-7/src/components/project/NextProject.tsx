import type { CSSProperties, Ref } from 'react';
import { playSound } from '../../audio/sound';
import { useTransitionNavigate } from '../../transition';
import type { Work } from '../../types';
import { assetUrl } from '../../utils/works';
import { TransitionLink } from '../TransitionLink';
import { WorkCover } from '../WorkCover';

interface NextProjectProps {
  next: Work;
  number: string;
  /** The bar on the right; filled by useEdgeNavigation. */
  fillRef: Ref<HTMLSpanElement>;
}

/** The last screen of a project: the next work with two tilted tags and the "keep scrolling" bar. */
export function NextProject({ next, number, fillRef }: NextProjectProps) {
  const navigate = useTransitionNavigate();
  const href = `/work/${next.slug}`;

  return (
    <section className="next-project" aria-label="Next project" data-transition-enter data-transition-exit style={{ '--i': 1 } as CSSProperties}>
      <TransitionLink to="/" className="next-back" onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
        back to home
      </TransitionLink>
      <a
        href={assetUrl(`work/${next.slug}`)}
        className="next-image"
        aria-label={`next project: ${next.title}`}
        onPointerEnter={() => playSound('hover')}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          playSound('next');
          void navigate(href, { dir: 'next' });
        }}
      >
        <WorkCover work={next} number={number} className="next-cover" />
        <span className="next-tag next-tag-top" aria-hidden="true">
          see the case
        </span>
        <span className="next-tag next-tag-bottom" aria-hidden="true">
          scroll
        </span>
        <span className="next-title">{next.title}</span>
      </a>
      <div className="next-progress" aria-hidden="true">
        <span ref={fillRef} className="next-progress-fill" />
      </div>
    </section>
  );
}
