import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Work } from '../../types';
import { WorkCover } from '../WorkCover';

interface ProjectStyleframesProps {
  work: Work;
  number: string;
}

const SAMPLE_FRAMES = 3;

/**
 * Stills of the work, alternating left and right. Each frame grows from half size while its image settles from
 * 1.5× zoom, driven by its position in the viewport (one scroll listener, one rAF). Sample entries show
 * generative frames; real works show `styleframes` and nothing when there are none.
 */
export function ProjectStyleframes({ work, number }: ProjectStyleframesProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const frames: Array<string | null> = work.styleframes?.length ? work.styleframes : work.isSample ? Array(SAMPLE_FRAMES).fill(null) : [];

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.styleframe'));
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const item of items) {
        const top = item.getBoundingClientRect().top;
        const t = reducedMotion ? 1 : Math.min(Math.max((vh - top) / (vh * 0.65), 0), 1);
        const eased = 1 - Math.pow(1 - t, 3);
        item.style.setProperty('--sf', eased.toFixed(4));
      }
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, [work.slug, reducedMotion, frames.length]);

  if (frames.length === 0) return null;

  return (
    <section ref={ref} className="styleframes" aria-label="Styleframes">
      {frames.map((src, i) => (
        <figure key={i} className="styleframe">
          <WorkCover work={work} number={number} image={src} seed={`${work.slug}-frame-${i}`} className="styleframe-image" />
        </figure>
      ))}
    </section>
  );
}
