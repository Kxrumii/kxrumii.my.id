import { publishCanvasColor } from '@kxrumii/transition-bridge';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'kxrumii:pertemuan-6:theme';
export const TASK6_PAGE_IDS = ['task-6', 'task-6-docs'] as const;
export type Task6PageId = (typeof TASK6_PAGE_IDS)[number];

/** Warna canvas halaman per tema; harus sama dengan `--t6-canvas` di style.css. */
export const THEME_CANVAS: Record<Theme, string> = {
  dark: '#10110f',
  light: '#e9e8e4',
};

export function isTask6PageId(value: string | undefined): value is Task6PageId {
  return value === 'task-6' || value === 'task-6-docs';
}

/** Publikasikan warna canvas tema aktif buat halaman Task 6 dan Dokumentasi. */
export function publishTask6CanvasColors(
  theme: Theme,
  publisher: (pageId: string, color: string) => void = publishCanvasColor,
): void {
  const color = THEME_CANVAS[theme];
  for (const pageId of TASK6_PAGE_IDS) {
    try {
      publisher(pageId, color);
    } catch {
      /* storage nggak tersedia: fallback link tetap sinkron */
    }
  }
}

/** Sinkronkan fallback `data-transition-canvas` di link Task 6 ↔ Dokumentasi, tanpa nyentuh link Portal. */
export function syncTransitionCanvasLinks(
  theme: Theme,
  root: ParentNode = document,
): void {
  const color = THEME_CANVAS[theme];
  for (const link of Array.from(
    root.querySelectorAll<HTMLElement>('a[data-transition-link="document"][data-transition-page]'),
  )) {
    if (isTask6PageId(link.dataset.transitionPage)) {
      link.dataset.transitionCanvas = color;
    }
  }
}

const LABELS: Record<Theme, string> = { dark: 'Gelap', light: 'Terang' };

/** Tema yang dipakai: pilihan tersimpan kalau valid, kalau nggak ikut sistem; default gelap. */
export function resolveTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function writeStored(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage nggak tersedia: tema tetap berlaku di sesi ini */
  }
}

/** Terapkan tema ke dokumen, publikasikan canvas buat Task 6 & Dokumentasi, dan sinkronkan link fallback. */
export function applyTheme(theme: Theme, persist = true, root: ParentNode = document): void {
  document.documentElement.dataset.theme = theme;
  if (persist) writeStored(theme);
  publishTask6CanvasColors(theme);
  syncTransitionCanvasLinks(theme, root);
}

/** Sakelar tema: tombol biasa, labelnya nyebut keadaan sekarang dan tujuannya. */
export function initThemeToggle(
  button: HTMLButtonElement,
  extraButtons: readonly HTMLButtonElement[] = [],
  root: ParentNode = document,
): void {
  const buttons = [button, ...extraButtons];
  const sync = (): void => {
    const theme = currentTheme();
    const text = `Tema: ${LABELS[theme]}`;
    const label = `Tema ${LABELS[theme].toLowerCase()}. Ganti ke ${LABELS[otherTheme(theme)].toLowerCase()}`;
    for (const btn of buttons) {
      btn.textContent = text;
      btn.setAttribute('aria-label', label);
    }
  };
  // Script inline di <head> sudah masang data-theme; kalau belum ada, tentukan di sini.
  if (!document.documentElement.dataset.theme) {
    applyTheme(
      resolveTheme(readStored(), window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false),
      false,
      root,
    );
  } else {
    const active = currentTheme();
    publishTask6CanvasColors(active);
    syncTransitionCanvasLinks(active, root);
  }
  sync();
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      applyTheme(otherTheme(currentTheme()), true, root);
      sync();
    });
  }
}
