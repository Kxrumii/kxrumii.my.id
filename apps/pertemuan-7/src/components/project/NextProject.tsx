import { useEffect, useRef } from 'react';
import { playSound } from '../../audio/sound';
import { useTransitionNavigate } from '../../transition';
import type { Work } from '../../types';
import { accumulate, DRAIN_DELAY_MS, drain, isAtBottom, isComplete, normalizeWheel } from '../../utils/nextProgress';
import { TransitionLink } from '../TransitionLink';
import { WorkCover } from '../WorkCover';

interface NextProjectProps {
  next: Work;
  number: string;
}

const KEY_STEP_PX = 140;

/**
 * The last screen of a project: the next work with two tilted tags and, on the right, a bar that fills while
 * the visitor keeps scrolling past the bottom (wheel, touch drag or ↓ / PageDown / Space). Full → the next work
 * opens. The bar drains when the input stops. Clicking the image goes there directly.
 */
export function NextProject({ next, number }: NextProjectProps) {
  const navigate = useTransitionNavigate();
  const fillRef = useRef<HTMLSpanElement>(null);
  const href = `/work/${next.slug}`;

  useEffect(() => {
    let progress = 0;
    let lastInput = 0;
    let raf = 0;
    let lastFrame = 0;
    let done = false;
    let touchY: number | null = null;

    const atBottom = () => isAtBottom(window.scrollY, window.innerHeight, document.documentElement.scrollHeight);
    const render = () => {
      fillRef.current?.style.setProperty('--progress', progress.toFixed(4));
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
      lastFrame = now;
      if (now - lastInput > DRAIN_DELAY_MS) progress = drain(progress, dt);
      render();
      if (progress > 0 && !done) raf = requestAnimationFrame(frame);
      else lastFrame = 0;
    };
    const push = (px: number) => {
      if (done || !atBottom()) return;
      progress = accumulate(progress, px);
      lastInput = performance.now();
      render();
      if (isComplete(progress)) {
        done = true;
        playSound('next');
        void navigate(href);
        return;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onWheel = (event: WheelEvent) => push(normalizeWheel(event.deltaY, event.deltaMode, window.innerHeight));
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      push((touchY - y) * 1.6);
      touchY = y;
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !target?.closest('button, a'))) push(KEY_STEP_PX);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [href, navigate]);

  return (
    <section className="next-project" aria-label="Next project">
      <TransitionLink to="/" className="next-back" onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
        back to home
      </TransitionLink>
      <TransitionLink to={href} className="next-image" aria-label={`next project: ${next.title}`} onPointerEnter={() => playSound('hover')} onClick={() => playSound('next')}>
        <WorkCover work={next} number={number} className="next-cover" />
        <span className="next-tag next-tag-top" aria-hidden="true">
          see the case
        </span>
        <span className="next-tag next-tag-bottom" aria-hidden="true">
          scroll
        </span>
        <span className="next-title">{next.title}</span>
      </TransitionLink>
      <div className="next-progress" aria-hidden="true">
        <span ref={fillRef} className="next-progress-fill" />
      </div>
    </section>
  );
}
