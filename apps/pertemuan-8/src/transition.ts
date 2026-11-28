/*
 * Pasang Shared Transition Bridge buat Task 8.
 * Cukup sekali pas modul diinisialisasi (sebelum React render); sinyal page-ready
 * dikirim usePageReady() setelah shell ke-commit.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, type TransitionBridge } from '@kxrumii/transition-bridge';
import { useEffect, type CSSProperties } from 'react';

// Harus sama dengan background `:root` di style.css.
const PAGE_CANVAS_COLOR = '#10110f';

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

// Dijaga supaya modul yang dievaluasi ulang (HMR dev) nggak masang bridge kedua.
export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: 'task-8',
  pageCanvasColor: PAGE_CANVAS_COLOR,
}));

/**
 * Tandai page-ready setelah shell ke-commit ke DOM. Effect jalan setelah commit, dan
 * markPageReady() idempotent, jadi double invoke StrictMode aman.
 * Bridge sengaja nggak di-destroy waktu unmount.
 */
export function usePageReady(): void {
  useEffect(() => {
    bridge.markPageReady();
  }, []);
}

/** Indeks stagger buat elemen yang ikut transisi rute. */
export function transitionIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
