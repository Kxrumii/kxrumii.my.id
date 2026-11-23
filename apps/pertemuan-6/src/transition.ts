/*
 * Shared Transition Bridge installation for Task 6.
 * Installation happens at module initialisation; page readiness is signalled
 * separately by main.ts once the application shell has been rendered.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';

// Must match the `:root` background in style.css.
const PAGE_CANVAS_COLOR = '#10110f';

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: 'task-6',
  pageCanvasColor: PAGE_CANVAS_COLOR,
}));
