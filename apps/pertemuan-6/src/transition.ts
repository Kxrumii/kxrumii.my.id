/*
 * Shared Transition Bridge installation for Task 6.
 * Installation happens at module initialisation; page readiness is signalled
 * separately by main.ts once the application shell has been rendered.
 * The canvas colour follows the active light/dark theme (see theme.ts).
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';
import { THEME_CANVAS, currentTheme } from './theme.ts';

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

const themeCanvas = (): string => THEME_CANVAS[currentTheme()];

export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: 'task-6',
  pageCanvasColor: THEME_CANVAS.dark,
  getCanvasColor: themeCanvas,
}));

// Saat tema diganti, beri tahu bridge warna canvas aktual (dipakai halaman asal berikutnya).
let lastCanvas = themeCanvas();
new MutationObserver(() => {
  const next = themeCanvas();
  if (next === lastCanvas) return;
  lastCanvas = next;
  bridge.setPageCanvasColor(next);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
