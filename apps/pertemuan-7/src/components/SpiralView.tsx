import type { KeyboardEvent, MouseEvent } from 'react';
import { useSound } from '../audio/useSound';
import { CATEGORY_LABELS } from '../data/works';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSpiral } from '../hooks/useSpiral';
import type { Work } from '../types';
import { cardFace } from '../utils/cardFace';
import { TransitionLink } from './TransitionLink';

interface SpiralViewProps {
  works: Work[];
  activeSlug: string | null;
  onActivate: (slug: string) => void;
}

/**
 * CSS 3D spiral of work cards (Pacôme flow). 3D chain:
 * .spiral-viewport (perspective) > .spiral-helix (preserve-3d) > .spiral-card.
 * Nothing in that chain uses filter, clip-path or overflow, so no browser
 * flattens it. Cards use a roving tabindex; ←/→ move between them.
 */
export function SpiralView({ works, activeSlug, onActivate }: SpiralViewProps) {
  const reducedMotion = useReducedMotion();
  const { play } = useSound();
  const activeIndex = Math.max(
    0,
    works.findIndex((work) => work.slug === activeSlug),
  );
  const spiral = useSpiral({
    count: works.length,
    initialIndex: activeIndex,
    resetKey: works.map((work) => work.slug).join('|'),
    reducedMotion,
    onActiveChange: (index) => {
      const work = works[index];
      if (work) onActivate(work.slug);
    },
  });
  const loops = works.length >= 3;

  function focusCard(container: HTMLElement, index: number) {
    container.querySelector<HTMLElement>(`[data-index="${index}"] a`)?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const next = spiral.step(event.key === 'ArrowRight' ? 1 : -1);
    if (next >= 0) focusCard(event.currentTarget, next);
  }

  function handleCardClick(event: MouseEvent<HTMLAnchorElement>, index: number, isActive: boolean) {
    if (spiral.consumeDrag()) {
      event.preventDefault();
      return;
    }
    if (!isActive) {
      // A side card comes to the front first; the active card opens the work.
      event.preventDefault();
      spiral.goTo(index);
      return;
    }
    play('click');
  }

  const atStart = !loops && activeIndex <= 0;
  const atEnd = !loops && activeIndex >= works.length - 1;

  return (
    <div className="spiral-view">
      <div
        className="spiral-viewport"
        ref={spiral.viewportRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Spiral karya — geser, scroll, atau gunakan panah kiri/kanan"
        onKeyDown={handleKeyDown}
      >
        <ul className="spiral-helix">
          {works.map((work, index) => {
            const isActive = work.slug === activeSlug;
            const face = cardFace(work);
            return (
              <li
                key={work.slug}
                ref={spiral.cardRef(index)}
                className="spiral-card"
                data-index={index}
                data-work-slug={work.slug}
                data-active={isActive ? 'true' : undefined}
              >
                <TransitionLink
                  className="spiral-card-link"
                  to={`/work/${work.slug}`}
                  tabIndex={isActive ? 0 : -1}
                  draggable={false}
                  style={{ background: face.background, color: face.ink }}
                  onMouseEnter={() => play('hover')}
                  onClick={(event) => handleCardClick(event, index, isActive)}
                >
                  <span className="spiral-card-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="spiral-card-title">{work.title}</span>
                  <span className="spiral-card-meta">{CATEGORY_LABELS[work.category]}</span>
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="spiral-controls">
        <button type="button" className="spiral-step" aria-label="Karya sebelumnya" disabled={works.length <= 1 || atStart} onClick={() => spiral.step(-1)}>
          ←
        </button>
        <p className="ui-label spiral-hint">scroll · geser · ← →</p>
        <button type="button" className="spiral-step" aria-label="Karya berikutnya" disabled={works.length <= 1 || atEnd} onClick={() => spiral.step(1)}>
          →
        </button>
      </div>
    </div>
  );
}
