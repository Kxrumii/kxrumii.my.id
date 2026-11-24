/*
 * Shared Transition Bridge installation for Task 6 (`task-6` and `task-6-docs`).
 * Installation happens at module initialisation; page readiness is signalled
 * separately by main.ts / docs.ts once the document shell has initialised.
 * The canvas colour and outgoing link fallbacks follow the active light/dark theme.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';
import {
  THEME_CANVAS,
  currentTheme,
  isTask6PageId,
  publishTask6CanvasColors,
  syncTransitionCanvasLinks,
  type Task6PageId,
} from './theme.ts';

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
    __kxrumiiTask6ThemeObserver?: MutationObserver;
  }
}

const themeCanvas = (): string => THEME_CANVAS[currentTheme()];

export function resolveTask6PageId(
  bodyDataset?: Record<string, string | undefined>,
  pathname = '',
): Task6PageId {
  if (isTask6PageId(bodyDataset?.task6Page)) return bodyDataset.task6Page;
  return pathname.includes('/dokumentasi') ? 'task-6-docs' : 'task-6';
}

export function installTask6Transition(
  pageId: Task6PageId = resolveTask6PageId(document.body?.dataset, location.pathname),
): TransitionBridge {
  const existing = window.__kxrumiiTransitionBridge;
  let activeBridge: TransitionBridge;
  if (existing && existing.pageId === pageId) {
    activeBridge = existing;
  } else {
    existing?.destroy();
    activeBridge = installTransitionBridge({
      pageId,
      pageCanvasColor: THEME_CANVAS.dark,
      getCanvasColor: themeCanvas,
    });
    window.__kxrumiiTransitionBridge = activeBridge;
  }

  const initialTheme = currentTheme();
  publishTask6CanvasColors(initialTheme);
  syncTransitionCanvasLinks(initialTheme);

  // Saat tema diganti, perbarui warna bridge, publikasi kedua pageId, dan fallback atribut tautan.
  if (!window.__kxrumiiTask6ThemeObserver) {
    let lastTheme = initialTheme;
    const observer = new MutationObserver(() => {
      const theme = currentTheme();
      if (theme === lastTheme) return;
      lastTheme = theme;
      const current = window.__kxrumiiTransitionBridge ?? activeBridge;
      current.setPageCanvasColor(THEME_CANVAS[theme]);
      publishTask6CanvasColors(theme);
      syncTransitionCanvasLinks(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.__kxrumiiTask6ThemeObserver = observer;
  }

  return activeBridge;
}

export const bridge: TransitionBridge = installTask6Transition(
  typeof document !== 'undefined' && typeof location !== 'undefined'
    ? resolveTask6PageId(document.body?.dataset, location.pathname)
    : 'task-6',
);
