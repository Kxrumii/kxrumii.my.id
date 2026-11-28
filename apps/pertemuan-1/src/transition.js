/*
 * Shared Transition Bridge buat Task 1 (halaman HTML-first).
 * Halaman langsung kepakai begitu modul ini jalan, jadi page-ready langsung.
 * Warna canvas ngikutin class tema terang/gelap di <html>.
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

// Toggle tema ada di script inline halaman; aku amati hasilnya aja,
// script-nya nggak diubah.
let currentCanvas = themeCanvas();
new MutationObserver(() => {
  const next = themeCanvas();
  if (next === currentCanvas) return;
  currentCanvas = next;
  bridge.setPageCanvasColor(next);
}).observe(root, { attributes: true, attributeFilter: ['class'] });

bridge.markPageReady();
