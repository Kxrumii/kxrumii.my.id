import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { useSound } from '../audio/useSound';
import { CATEGORY_LABELS } from '../data/works';
import { cancelMorph, playMorph } from '../motion/morphRunner';
import type { Work } from '../types';
import { cardFace } from '../utils/cardFace';

interface WorkDisplayProps {
  work: Work;
  /** Box size in px (already scaled and fitted to the work's aspect ratio). */
  width: number;
  height: number;
  active: boolean;
  /** Active display during HOLD, with the sheet closed: the only state in which it can be hovered, focused or opened. */
  interactive: boolean;
  reducedMotion: boolean;
  onHoverEnter: (slug: string) => void;
  onHoverLeave: () => void;
}

/**
 * One work in the room. It never carries a transform of its own: the anchor above it places it in the world and the
 * camera moves everything, so there is no second writer. The hover Shape Morph runs on `.work-mask` (clip-path only).
 * `data-work-slug` is also what the detail sheet measures for its FLIP, and the link inside is what gets refocused.
 */
export function WorkDisplay({ work, width, height, active, interactive, reducedMotion, onHoverEnter, onHoverLeave }: WorkDisplayProps) {
  const maskRef = useRef<HTMLSpanElement>(null);
  const hovered = useRef(false);
  const { play } = useSound();
  const face = useMemo(() => cardFace(work), [work]);

  // Losing eligibility (navigation started, sheet opened...) folds a hover shape back, with the same morph lifecycle.
  useEffect(() => {
    const mask = maskRef.current;
    if (interactive || !hovered.current || !mask) return;
    hovered.current = false;
    playMorph(mask, 'hover-leave', { reducedMotion });
  }, [interactive, reducedMotion]);

  useEffect(() => {
    const mask = maskRef.current;
    return () => {
      if (mask) cancelMorph(mask);
    };
  }, []);

  function enter(pointerType: string) {
    if (!interactive || pointerType === 'touch') return;
    onHoverEnter(work.slug);
    if (!hovered.current && maskRef.current) {
      hovered.current = true;
      playMorph(maskRef.current, 'hover-enter', { reducedMotion });
    }
    play('hover');
  }

  function leave() {
    onHoverLeave();
    if (!hovered.current || !maskRef.current) return;
    hovered.current = false;
    playMorph(maskRef.current, 'hover-leave', { reducedMotion });
  }

  return (
    <div
      className="work-display"
      data-work-slug={work.slug}
      data-active={active ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
      style={{ width, height, left: -width / 2, top: -height / 2 }}
    >
      <Link
        className="work-display-link"
        to={`/work/${work.slug}`}
        state={{ fromStage: true, originMode: 'gallery' }}
        tabIndex={active ? 0 : -1}
        draggable={false}
        aria-label={`${work.title} — ${CATEGORY_LABELS[work.category]}`}
        onPointerEnter={(event) => enter(event.pointerType)}
        onPointerLeave={leave}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) enter('keyboard');
        }}
        onBlur={leave}
        onClick={() => play('click')}
      >
        <span className="work-mask" ref={maskRef} data-morph-mask="">
          <span className="work-media" style={{ background: face.background }}>
            {work.thumbnail ? <img src={work.thumbnail} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
          </span>
          <span className="work-perforation" data-morph-perforation="" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
