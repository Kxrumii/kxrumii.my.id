import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSound } from '../audio/sound';
import { categoryLabel } from '../data/works';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Work } from '../types';
import { workNumber } from '../utils/works';
import { TransitionLink } from './TransitionLink';
import { WorkCover } from './WorkCover';

interface ListViewProps {
  works: Work[];
}

const FOLLOW = 0.18;

/**
 * Karya sebagai judul besar di tengah. Hover satu judul meredupkan yang lain dan menampilkan cover-nya, yang
 * mengikuti kursor (cuma di perangkat pointer; pas reduced motion cover diam di tempat).
 */
export function ListView({ works }: ListViewProps) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const position = useRef({ x: 0, y: 0, raf: 0, placed: false });

  useEffect(() => {
    const p = position.current;
    if (hovered === null) {
      cancelAnimationFrame(p.raf);
      p.raf = 0;
      return;
    }
    const tick = () => {
      const el = preview.current;
      if (!el) return;
      const k = reducedMotion || !p.placed ? 1 : FOLLOW;
      p.x += (target.current.x - p.x) * k;
      p.y += (target.current.y - p.y) * k;
      p.placed = true;
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(-4deg)`;
      p.raf = requestAnimationFrame(tick);
    };
    p.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(p.raf);
      p.raf = 0;
    };
  }, [hovered, reducedMotion]);

  if (works.length === 0) return <p className="empty">No works yet.</p>;

  const shown = hovered === null ? null : works[hovered];

  return (
    <div
      className="list"
      onPointerMove={(event) => {
        target.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerLeave={() => {
        setHovered(null);
        position.current.placed = false;
      }}
    >
      <ol className="list-items">
        {works.map((work, index) => (
          <li key={work.slug} className="list-item" style={{ '--i': index } as CSSProperties}>
            <TransitionLink
              to={`/work/${work.slug}`}
              className={`list-link${hovered === index ? ' hovered' : ''}`}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
                  target.current = { x: event.clientX, y: event.clientY };
                  setHovered(index);
                }
                playSound('hover');
              }}
              onFocus={() => setHovered(null)}
              onClick={() => playSound('click')}
            >
              <span className="list-meta">
                {workNumber(index)} · {categoryLabel(work)}
              </span>
              <span className="list-mask">
                <span className="list-title">{work.title}</span>
              </span>
            </TransitionLink>
          </li>
        ))}
      </ol>
      <div ref={preview} className={`list-preview${shown ? ' show' : ''}`} aria-hidden="true">
        {shown ? <WorkCover work={shown} number={workNumber(hovered ?? 0)} eager /> : null}
      </div>
    </div>
  );
}
