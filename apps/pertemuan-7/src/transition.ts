/*
 * Shared Transition Bridge installation for Task 7.
 * Installation happens once at module initialisation (before React renders);
 * page readiness is signalled by usePageReady() after the shell commits.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';
import { useCallback, useEffect, type CSSProperties } from 'react';
import { useNavigate, type To } from 'react-router';

// Must match the `:root` background in style.css.
const PAGE_CANVAS_COLOR = '#10110f';

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

// Guarded so a re-evaluated module (dev HMR) never installs a second bridge.
export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: 'task-7',
  pageCanvasColor: PAGE_CANVAS_COLOR,
}));

/**
 * Marks page-ready after the shell has committed to the DOM. Effects run after
 * commit; markPageReady() is idempotent, so StrictMode's double invocation is safe.
 * The bridge is intentionally not destroyed on unmount.
 *
 * Pass the route key so every route commit signals readiness again: the bridge
 * resets its readiness flag at the start of each same-document transition.
 */
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
 * Same-document route transitions.
 *
 * BrowserRouter wraps every state update in React.startTransition, so
 * flushSync(() => navigate(to)) returns BEFORE the new route is committed (the
 * URL has changed but the old page is still in the DOM). The bridge's
 * transitionTo() expects update() to resolve once the destination DOM exists,
 * so we wait for a real commit signal from the layout instead of flushing.
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
 * Navigate with the shared exit -> swap -> enter transition. Resolves to false
 * when the bridge declined (a transition is already running).
 */
export function useTransitionNavigate(): (to: To) => Promise<boolean> {
  const navigate = useNavigate();
  return useCallback(
    (to: To) =>
      bridge.transitionTo(async () => {
        const committed = nextRouteCommit(1500);
        navigate(to);
        await committed;
      }),
    [navigate],
  );
}
