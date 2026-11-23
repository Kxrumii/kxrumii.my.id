export interface ExitEnterContext {
  root: HTMLElement;
  elements: HTMLElement[];
  reducedMotion: boolean;
  toColor?: string;
  /** Jalankan exit/enter bawaan untuk elemen tertentu (komposisi dengan gerak khusus). */
  animateElements(elements: Iterable<HTMLElement>, kind: 'exit' | 'enter'): Animation[];
}

export interface TransitionBridgeOptions {
  pageId: string;
  pageCanvasColor?: string;
  /** Warna canvas AKTUAL halaman ini (tema/mood). Dipanggil saat install. */
  getCanvasColor?: () => string;
  fallbackCanvasColor?: string;
  linkSelector?: string;
  exitMaxMs?: number;
  enterMaxMs?: number;
  pageReadyTimeoutMs?: number;
  stallRecoveryMs?: number;
  prefetch?: boolean;
  exit?: (ctx: ExitEnterContext) => Promise<unknown> | void;
  enter?: (ctx: ExitEnterContext) => Promise<unknown> | void;
}

export interface TransitionBridge {
  pageId: string;
  incoming: boolean;
  markPageReady(detail?: Record<string, unknown>): void;
  markSceneReady(detail?: Record<string, unknown>): void;
  transitionTo(
    update: () => void | Promise<void>,
    options?: { canvasColor?: string; toPage?: string; pageReadyTimeoutMs?: number },
  ): Promise<boolean>;
  /** Panggil saat warna canvas halaman berubah (toggle tema, ganti mood). */
  setPageCanvasColor(color: string): void;
  destroy(): void;
}

export function installTransitionBridge(options: TransitionBridgeOptions): TransitionBridge;
export function animateElements(elements: Iterable<HTMLElement>, kind: 'exit' | 'enter'): Animation[];
export function publishCanvasColor(pageId: string, color: string): void;
export function readPublishedCanvasColor(pageId: string | null): string | null;
export const transitionEvents: Readonly<{ pageReady: string; sceneReady: string; transition: string }>;
export const transitionStorageKey: string;
