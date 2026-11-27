import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { playSound } from '../audio/sound';
import { CATEGORY_LABELS } from '../data/works';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTransitionNavigate } from '../transition';
import type { Work } from '../types';
import { workIndexForSlot } from '../spiral/geometry';
import { useSpiral } from '../spiral/useSpiral';
import { workNumber } from '../utils/works';
import { pillClass, Letters } from './PillButton';
import { TransitionLink } from './TransitionLink';
import { WorkCover } from './WorkCover';

interface SpiralViewProps {
  works: Work[];
  /** Loader or menu up: no drift, no input. */
  paused: boolean;
}

/**
 * The works as a vertical CSS 3D helix. Scroll, drag or use the arrow keys to turn it; the work facing the
 * camera is named in the caption below, and clicking any front card opens that work.
 *
 * Cards are decorative for assistive technology (they repeat around the coil); the region itself is the
 * keyboard target and the caption holds the one real link to the active work.
 */
export function SpiralView({ works, paused }: SpiralViewProps) {
  const reducedMotion = useReducedMotion();
  const navigate = useTransitionNavigate();
  const [active, setActive] = useState(0);
  const onActiveChange = useCallback((index: number) => setActive(index), []);
  const spiral = useSpiral({ workCount: works.length, initialIndex: 0, reducedMotion, paused, onActiveChange });

  const slots = useMemo(() => Array.from({ length: spiral.slots }, (_, slot) => workIndexForSlot(slot, works.length)), [spiral.slots, works.length]);

  if (works.length === 0) return <p className="empty">No works yet.</p>;

  const current = works[Math.max(active, 0)] ?? works[0];
  const currentNumber = workNumber(Math.max(active, 0));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      spiral.step(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      spiral.step(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      playSound('click');
      void navigate(`/work/${current.slug}`);
    }
  };

  return (
    <div className="spiral">
      <div
        ref={spiral.viewportRef}
        className="spiral-viewport"
        tabIndex={0}
        role="region"
        aria-roledescription="spiral gallery"
        aria-label={`Works spiral. Use the arrow keys to turn it, Enter to open the work in front: ${current.title}.`}
        onKeyDown={onKeyDown}
      >
        <div className="spiral-scene">
          {slots.map((workIndex, slot) => {
            const work = works[workIndex];
            return (
              <a
                key={slot}
                ref={spiral.cardRef(slot)}
                className="spiral-card"
                href={`work/${work.slug}`}
                tabIndex={-1}
                aria-hidden="true"
                draggable={false}
                onPointerEnter={() => {
                  spiral.setHover(true);
                  playSound('hover');
                }}
                onPointerLeave={() => spiral.setHover(false)}
                onClick={(event) => {
                  event.preventDefault();
                  if (spiral.consumeDrag()) return;
                  playSound('click');
                  void navigate(`/work/${work.slug}`);
                }}
              >
                <WorkCover work={work} number={workNumber(workIndex)} eager={slot < 4} className="spiral-face" />
                <span className="spiral-back" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </div>
      <div className="spiral-caption" aria-live="polite">
        <p className="spiral-caption-meta">
          <span>{currentNumber}</span>
          <span>{CATEGORY_LABELS[current.category]}</span>
        </p>
        <p className="spiral-caption-title" key={current.slug}>
          {current.title}
        </p>
        <TransitionLink to={`/work/${current.slug}`} className={pillClass('light')} onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
          <Letters text="view project" />
        </TransitionLink>
      </div>
      <p className="spiral-hint" aria-hidden="true">
        scroll / drag
      </p>
    </div>
  );
}
