import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { playSound } from '../audio/sound';
import type { LayoutContext } from '../components/Layout';
import { ListView } from '../components/ListView';
import { SpiralView } from '../components/SpiralView';
import { ViewSwitch, type WorksView } from '../components/ViewSwitch';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { transitionIndex } from '../transition';

const EXIT_EASE = 'cubic-bezier(0.55, 0, 0.75, 0.2)';

/** Exit motion of the view on screen; resolves when it has finished. */
function playExit(stage: HTMLElement, view: WorksView): Promise<unknown> {
  const animations: Animation[] = [];
  if (view === 'spiral') {
    stage.querySelectorAll<HTMLElement>('.spiral-card').forEach((card) => {
      const away = Number.parseFloat(card.style.getPropertyValue('--ad')) || 0;
      if (away > 2.5) return;
      const face = card.querySelector<HTMLElement>('.spiral-face');
      if (!face) return;
      animations.push(
        face.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.6)', opacity: 0 }], {
          duration: 380,
          delay: away * 70,
          easing: EXIT_EASE,
          fill: 'forwards',
        }),
      );
    });
    const caption = stage.querySelector<HTMLElement>('.spiral-caption');
    if (caption) animations.push(caption.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(16px)' }], { duration: 300, fill: 'forwards' }));
  } else {
    stage.querySelectorAll<HTMLElement>('.list-item').forEach((item, i) => {
      const title = item.querySelector<HTMLElement>('.list-title');
      const meta = item.querySelector<HTMLElement>('.list-meta');
      if (title) animations.push(title.animate([{ transform: 'none' }, { transform: 'translateY(-105%)' }], { duration: 360, delay: i * 40, easing: EXIT_EASE, fill: 'forwards' }));
      if (meta) animations.push(meta.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 240, delay: i * 40, fill: 'forwards' }));
    });
  }
  return Promise.allSettled(animations.map((animation) => animation.finished));
}

/**
 * Home: every work as a spiral (default) or as a list, switched at the top centre (`?view=list`). Switching
 * plays the old view's exit (cards shrink away from the front, titles slide up out of their masks) and then
 * the new view's enter (see works.css).
 */
export function WorksPage() {
  const { entered, menuOpen } = useOutletContext<LayoutContext>();
  const reducedMotion = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const view: WorksView = params.get('view') === 'list' ? 'list' : 'spiral';
  const [shown, setShown] = useState<WorksView>(view);
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  usePageTitle(shown === 'list' ? 'works list' : null);

  // The URL is the source of truth (switch, back/forward); the stage follows it through an exit.
  useEffect(() => {
    if (view === shown) return;
    const stage = stageRef.current;
    if (reducedMotion || !stage) {
      setShown(view);
      return;
    }
    let cancelled = false;
    setLeaving(true);
    void playExit(stage, shown).then(() => {
      if (cancelled) return;
      setShown(view);
      setLeaving(false);
    });
    return () => {
      cancelled = true;
    };
  }, [view, shown, reducedMotion]);

  const setView = (next: WorksView) => {
    if (next === view) return;
    playSound(next === 'list' ? 'list' : 'spiral');
    setParams(next === 'list' ? { view: 'list' } : {}, { replace: true, preventScrollReset: true });
  };

  return (
    <>
      <h1 className="sr-only">Works</h1>
      <ViewSwitch view={view} onChange={setView} data-transition-enter data-transition-exit style={transitionIndex(0)} />
      <div
        ref={stageRef}
        className="works-stage"
        data-view={shown}
        data-leaving={leaving || undefined}
        data-transition-enter
        data-transition-exit
        style={transitionIndex(1)}
      >
        {shown === 'spiral' ? <SpiralView key="spiral" works={works} paused={!entered || menuOpen || leaving} /> : <ListView key="list" works={works} />}
      </div>
    </>
  );
}
