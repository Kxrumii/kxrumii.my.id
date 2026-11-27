/*
 * Shared Transition Bridge installation for Task 7 (portfolio).
 * Installed once at module initialisation (before React renders); page readiness is signalled by
 * usePageReady() after each route commits.
 *
 * Canvas: the app is a single near-black canvas (#0a0a0a), equal to the Portal's `canvasFallback` for task-7,
 * so there is no hand-off colour.
 *
 * Scopes: same-document route changes run with `data-route-scope="stage"`, so only the page content moves
 * while the fixed chrome (`[data-shell]`) stays put. Document navigations (to/from the Portal) animate all.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, publishCanvasColor, transitionEvents, type ExitEnterContext, type TransitionBridge } from '@kxrumii/transition-bridge';
import { useCallback, useEffect, type CSSProperties } from 'react';
import { useNavigate, type To } from 'react-router';

export const PAGE_ID = 'task-7';
/** Must stay equal to the Portal's `canvasFallback` for task-7 and to `--color-bg-dark`. */
export const CANVAS = '#0a0a0a';

const root = document.documentElement;

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

function participants(elements: HTMLElement[]): HTMLElement[] {
  if (root.dataset.routeScope === 'stage') return elements.filter((el) => el.closest('[data-shell]') === null);
  return elements;
}

export type RouteDirection = 'next' | 'prev';

/*
 * Page motion after the reference (its `project` / `project-fade` transitions), done with WAAPI instead of the
 * bridge's clip-path wipe, which read as a blink:
 *   default  exit: fade + settle to scale(.985)          enter: rise 80 px from scale(.96)
 *   next     exit: drift up and shrink                   enter: rise from below
 *   prev     exit: drift down and shrink                 enter: descend from above
 * The enter starts almost at once, so there is no empty frame between the two pages (the star field stays).
 */
const EXIT_FRAMES: Record<RouteDirection | 'default', Keyframe[]> = {
  default: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.985)' }],
  next: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -48px, 0) scale(0.96)' }],
  prev: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 48px, 0) scale(0.96)' }],
};
const ENTER_FROM: Record<RouteDirection | 'default', string> = {
  default: 'translate3d(0, 80px, 0) scale(0.96)',
  next: 'translate3d(0, 80px, 0) scale(0.96)',
  prev: 'translate3d(0, -80px, 0) scale(0.96)',
};
const SPRING_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

function direction(): RouteDirection | 'default' {
  const dir = root.dataset.routeDir;
  return dir === 'next' || dir === 'prev' ? dir : 'default';
}

async function run(ctx: ExitEnterContext, kind: 'exit' | 'enter'): Promise<void> {
  const dir = direction();
  const elements = participants(ctx.elements);
  const animations = elements.map((el, i) => {
    const index = Number.parseFloat(getComputedStyle(el).getPropertyValue('--i')) || i;
    if (kind === 'exit') {
      return el.animate(EXIT_FRAMES[dir], {
        duration: dir === 'default' ? 450 : 380,
        delay: Math.min(index, 3) * 30,
        easing: dir === 'default' ? 'ease' : 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      });
    }
    return el.animate([{ opacity: 0, transform: ENTER_FROM[dir] }, { opacity: 1, transform: 'none' }], {
      duration: 650,
      delay: (dir === 'default' ? 120 : 40) + Math.min(index, 3) * 60,
      easing: SPRING_OUT,
      fill: 'both',
    });
  });
  if (kind === 'enter') finishedEnters.push(...animations);
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

/*
 * Enter animations hold their end state (fill: both) until the bridge has left the `entering` state; only then
 * are they dropped, so the opacity pre-state rule never gets a frame to hide the new page.
 */
const finishedEnters: Animation[] = [];

// Guarded so a re-evaluated module (dev HMR) never installs a second bridge.
export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: PAGE_ID,
  pageCanvasColor: CANVAS,
  exit: (ctx) => run(ctx, 'exit'),
  enter: (ctx) => run(ctx, 'enter'),
}));

document.addEventListener(transitionEvents.transition, (event) => {
  const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
  if (phase === 'enter-end' || phase === 'recovered') {
    delete root.dataset.routeScope;
    delete root.dataset.routeDir;
    requestAnimationFrame(() => finishedEnters.splice(0).forEach((animation) => animation.cancel()));
    publishCanvasColor(PAGE_ID, CANVAS);
  }
});

/** Marks page-ready after a route has committed. Idempotent, so StrictMode's double effect is safe. */
export function usePageReady(routeKey?: string): void {
  useEffect(() => {
    bridge.markPageReady();
  }, [routeKey]);
}

/** Stagger index for an element taking part in the route transition. */
export function transitionIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/*
 * BrowserRouter wraps navigation in startTransition, so navigate() returns before the new route commits.
 * The bridge's transitionTo() expects update() to resolve once the destination DOM exists, so the layout
 * reports each commit through notifyRouteCommit().
 */
let resolveRouteCommit: (() => void) | null = null;

function nextRouteCommit(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolveRouteCommit = null;
      resolve(false);
    }, timeoutMs);
    resolveRouteCommit = () => {
      window.clearTimeout(timer);
      resolveRouteCommit = null;
      resolve(true);
    };
  });
}

/** Called by the layout from a layout effect, right after a route has committed. */
export function notifyRouteCommit(): void {
  resolveRouteCommit?.();
}

/**
 * Navigate with the stage-scoped exit → swap → enter transition. `dir` gives the motion a direction (next/previous
 * work). Resolves to false when one is already running.
 */
export function useTransitionNavigate(): (to: To, options?: { dir?: RouteDirection }) => Promise<boolean> {
  const navigate = useNavigate();
  return useCallback(
    async (to: To, options?: { dir?: RouteDirection }) => {
      if (root.dataset.transitionState) return false;
      root.dataset.routeScope = 'stage';
      if (options?.dir) root.dataset.routeDir = options.dir;
      else delete root.dataset.routeDir;
      const started = await bridge.transitionTo(
        async () => {
          const committed = nextRouteCommit(1500);
          navigate(to);
          await committed;
        },
        { canvasColor: CANVAS },
      );
      if (!started) {
        delete root.dataset.routeScope;
        delete root.dataset.routeDir;
      }
      publishCanvasColor(PAGE_ID, CANVAS);
      return started;
    },
    [navigate],
  );
}
