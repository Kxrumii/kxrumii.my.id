import { useEffect, useRef } from 'react';
import { playSound } from '../../audio/sound';
import { CATEGORY_LABELS } from '../../data/works';
import type { Work } from '../../types';
import { Letters, pillClass } from '../PillButton';

interface ProjectInfosProps {
  work: Work;
  number: string;
}

/**
 * Title on the left (5 columns), description on the right (3 columns). Each block rises out of its own mask
 * the first time it scrolls into view.
 */
export function ProjectInfos({ work, number }: ProjectInfosProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((block) => block.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -5% 0px' },
    );
    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
  }, [work.slug]);

  const meta = [number, CATEGORY_LABELS[work.category], work.year === null ? null : String(work.year), work.role].filter(Boolean);

  return (
    <section ref={ref} className="project-infos" aria-labelledby="project-title">
      <h1 id="project-title" className="project-title reveal">
        <span>{work.title}</span>
      </h1>
      <div className="project-right">
        <p className="project-meta reveal">
          <span>{meta.join(' · ')}</span>
        </p>
        <p className="project-text reveal" style={{ transitionDelay: '80ms' }}>
          <span>{work.summary}</span>
        </p>
        {work.notes ? (
          <p className="project-text reveal" style={{ transitionDelay: '160ms' }}>
            <span>{work.notes}</span>
          </p>
        ) : null}
        {work.isSample ? <p className="project-sample">sample entry — replace with a real work before publishing</p> : null}
        {work.externalUrl ? (
          <a className={pillClass('dark')} href={work.externalUrl} target="_blank" rel="noreferrer noopener" onPointerEnter={() => playSound('hover')}>
            <Letters text="see the case" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
