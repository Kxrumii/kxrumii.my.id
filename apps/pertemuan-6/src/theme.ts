import { publishCanvasColor } from '@kxrumii/transition-bridge';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'kxrumii:pertemuan-6:theme';

/** Warna canvas halaman per tema; harus sama dengan `--t6-canvas` pada style.css. */
export const THEME_CANVAS: Record<Theme, string> = {
  dark: '#10110f',
  light: '#e9e8e4',
};

const LABELS: Record<Theme, string> = { dark: 'Gelap', light: 'Terang' };

/** Tema yang dipakai: pilihan tersimpan bila valid, selain itu mengikuti sistem; bawaan gelap. */
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
    /* penyimpanan tidak tersedia: tema tetap berlaku untuk sesi ini */
  }
}

/** Menerapkan tema ke dokumen dan memberi tahu bridge warna canvas aktual halaman ini. */
export function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.dataset.theme = theme;
  if (persist) writeStored(theme);
  publishCanvasColor('task-6', THEME_CANVAS[theme]);
}

/** Sakelar tema: tombol biasa dengan label yang menyebut keadaan saat ini dan tujuannya. */
export function initThemeToggle(
  button: HTMLButtonElement,
  extraButtons: readonly HTMLButtonElement[] = [],
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
  // Skrip inline di <head> sudah memasang data-theme; jika tidak ada, tentukan di sini.
  if (!document.documentElement.dataset.theme) {
    applyTheme(resolveTheme(readStored(), window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false), false);
  } else {
    publishCanvasColor('task-6', THEME_CANVAS[currentTheme()]);
  }
  sync();
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      applyTheme(otherTheme(currentTheme()));
      sync();
    });
  }
}
