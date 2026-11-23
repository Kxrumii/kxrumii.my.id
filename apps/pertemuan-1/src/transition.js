/*
 * Shared Transition Bridge for Task 1 (HTML-first page).
 * The page is usable as soon as this module runs, so page-ready is immediate.
 * The canvas colour follows the existing light/dark theme class on <html>.
 */
import { installTransitionBridge } from '@kxrumii/transition-bridge';

const LIGHT_CANVAS = '#eff1f5';
const DARK_CANVAS = '#1e1e2e';

const root = document.documentElement;
const themeCanvas = () => (root.classList.contains('dark') ? DARK_CANVAS : LIGHT_CANVAS);

const bridge = installTransitionBridge({
  pageId: 'task-1',
  pageCanvasColor: LIGHT_CANVAS,
  getCanvasColor: themeCanvas,
});

// The theme toggle lives in the page's inline script; observe its result
// instead of changing that script.
let currentCanvas = themeCanvas();
new MutationObserver(() => {
  const next = themeCanvas();
  if (next === currentCanvas) return;
  currentCanvas = next;
  bridge.setPageCanvasColor(next);
}).observe(root, { attributes: true, attributeFilter: ['class'] });

bridge.markPageReady();
