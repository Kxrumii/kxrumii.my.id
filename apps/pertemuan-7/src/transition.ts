/*
 * Shared Transition Bridge installation for Task 7.
 * Installation happens once at module initialisation (before React renders);
 * page readiness is signalled by usePageReady() after the shell commits.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';
import { useEffect, type CSSProperties } from 'react';

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
 */
export function usePageReady(): void {
  useEffect(() => {
    bridge.markPageReady();
  }, []);
}

/** Stagger index for an element taking part in the route transition. */
export function transitionIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
