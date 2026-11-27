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

async function run(ctx: ExitEnterContext, kind: 'exit' | 'enter'): Promise<void> {
  const animations = ctx.animateElements(participants(ctx.elements), kind);
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

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

/** Navigate with the stage-scoped exit → swap → enter transition. Resolves to false when one is already running. */
export function useTransitionNavigate(): (to: To) => Promise<boolean> {
  const navigate = useNavigate();
  return useCallback(
    async (to: To) => {
      if (root.dataset.transitionState) return false;
      root.dataset.routeScope = 'stage';
      const started = await bridge.transitionTo(
        async () => {
          const committed = nextRouteCommit(1500);
          navigate(to);
          await committed;
        },
        { canvasColor: CANVAS },
      );
      if (!started) delete root.dataset.routeScope;
      publishCanvasColor(PAGE_ID, CANVAS);
      return started;
    },
    [navigate],
  );
}
