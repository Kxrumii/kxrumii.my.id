import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Work } from '../../types';
import { assetUrl } from '../../utils/works';
import { WorkCover } from '../WorkCover';

interface ProjectStyleframesProps {
  work: Work;
  number: string;
}

const SAMPLE_FRAMES = 3;

/**
 * Still karya, selang-seling kiri dan kanan. Tiap frame membesar dari setengah ukuran sementara gambarnya turun
 * dari zoom 1.5×, dikendalikan posisinya di viewport (satu scroll listener, satu rAF). Entri sample nampilin
 * frame generatif; karya asli nampilin `styleframes`, dan kosong kalau nggak ada.
 */
export function ProjectStyleframes({ work, number }: ProjectStyleframesProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const frames: Array<string | null> = work.styleframes.length ? work.styleframes : work.isSample ? Array(SAMPLE_FRAMES).fill(null) : [];

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
          <WorkCover work={work} number={number} image={src ? assetUrl(src) : null} seed={`${work.slug}-frame-${i}`} className="styleframe-image" />
        </figure>
      ))}
    </section>
  );
}
