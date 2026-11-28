import { useEffect, useRef } from 'react';
import { playSound } from '../../audio/sound';
import { categoryLabel } from '../../data/works';
import type { Work } from '../../types';
import { Letters, pillClass } from '../PillButton';

interface ProjectInfosProps {
  work: Work;
  number: string;
}

/**
 * Judul di kiri (5 kolom), deskripsi di kanan (3 kolom). Tiap blok naik dari mask-nya sendiri pas pertama kali
 * masuk layar. Detail yang kosong tampil "—" / "deskripsi menyusul", nggak pernah dikarang.
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

  const meta = [number, categoryLabel(work), work.year === null ? '—' : String(work.year), work.role ?? '—'];

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
          <span>{work.summary ?? 'deskripsi menyusul.'}</span>
        </p>
        {work.notes ? (
          <p className="project-text reveal" style={{ transitionDelay: '160ms' }}>
            <span>{work.notes}</span>
          </p>
        ) : null}
        {work.externalUrl ? (
          <a className={pillClass('dark')} href={work.externalUrl} target="_blank" rel="noreferrer noopener" onPointerEnter={() => playSound('hover')}>
            <Letters text="watch on youtube" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
