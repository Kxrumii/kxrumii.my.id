import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  TASK6_PAGE_IDS,
  THEME_CANVAS,
  applyTheme,
  initThemeToggle,
  otherTheme,
  publishTask6CanvasColors,
  resolveTheme,
  syncTransitionCanvasLinks,
} from '../src/theme.ts';

class MockLink {
  dataset: Record<string, string | undefined>;

  constructor(page: string | undefined, canvas?: string) {
    this.dataset = {
      transitionLink: 'document',
      transitionPage: page,
      transitionCanvas: canvas,
    };
  }
}

class MockButton {
  textContent: string | null = '';
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
  }
}

describe('resolveTheme', () => {
  it('memakai pilihan tersimpan yang valid', () => {
    assert.equal(resolveTheme('light', false), 'light');
    assert.equal(resolveTheme('dark', true), 'dark');
  });

  it('tanpa pilihan valid mengikuti sistem; bawaan gelap', () => {
    assert.equal(resolveTheme(null, true), 'light');
    assert.equal(resolveTheme(null, false), 'dark');
    assert.equal(resolveTheme('sepia', true), 'light');
    assert.equal(resolveTheme('', false), 'dark');
  });
});

describe('tema & sinkronisasi canvas Task 6 ↔ Dokumentasi', () => {
  const savedGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    localStorageDescriptor: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  };

  function setMockLocalStorage(mock: unknown): void {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: mock,
    });
  }

  let docElement: { dataset: Record<string, string | undefined> };
  let links: MockLink[];
  let root: ParentNode;

  beforeEach(() => {
    docElement = { dataset: {} };
    links = [
      new MockLink('task-6-docs', '#10110f'),
      new MockLink('task-6', '#10110f'),
      new MockLink('portal', '#0b0b0b'),
    ];
    root = {
      querySelectorAll(selector: string) {
        if (selector === 'a[data-transition-link="document"][data-transition-page]') {
          return links;
        }
        return [];
      },
    } as unknown as ParentNode;

    (globalThis as Record<string, unknown>).document = {
      documentElement: docElement,
      querySelectorAll: (selector: string) => root.querySelectorAll(selector),
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).document = savedGlobals.document;
    (globalThis as Record<string, unknown>).window = savedGlobals.window;
    if (savedGlobals.localStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', savedGlobals.localStorageDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  it('otherTheme membalik tema', () => {
    assert.equal(otherTheme('dark'), 'light');
    assert.equal(otherTheme('light'), 'dark');
  });

  it('canvas gelap sama dengan fallback Portal untuk Task 6', () => {
    assert.equal(THEME_CANVAS.dark, '#10110f');
    assert.match(THEME_CANVAS.light, /^#[0-9a-f]{6}$/);
  });

  it('publishTask6CanvasColors memublikasikan warna untuk task-6 dan task-6-docs serta aman saat publisher gagal', () => {
    const published: Array<[string, string]> = [];
    publishTask6CanvasColors('light', (pageId, color) => {
      published.push([pageId, color]);
    });
    assert.deepEqual(
      published,
      TASK6_PAGE_IDS.map((pageId) => [pageId, THEME_CANVAS.light]),
    );

    assert.doesNotThrow(() => {
      publishTask6CanvasColors('dark', () => {
        throw new Error('SecurityError');
      });
    });
  });

  it('syncTransitionCanvasLinks memperbarui tautan Task 6 & Dokumentasi sesuai tema dan membiarkan tautan Portal utuh', () => {
    syncTransitionCanvasLinks('light', root);
    assert.equal(links[0]!.dataset.transitionCanvas, THEME_CANVAS.light);
    assert.equal(links[1]!.dataset.transitionCanvas, THEME_CANVAS.light);
    assert.equal(links[2]!.dataset.transitionCanvas, '#0b0b0b');

    syncTransitionCanvasLinks('dark', root);
    assert.equal(links[0]!.dataset.transitionCanvas, THEME_CANVAS.dark);
    assert.equal(links[1]!.dataset.transitionCanvas, THEME_CANVAS.dark);
    assert.equal(links[2]!.dataset.transitionCanvas, '#0b0b0b');
  });

  it('applyTheme dan initThemeToggle tetap aman saat localStorage diblokir dan langsung menyinkronkan fallback tautan', () => {
    const store = new Map<string, string>();
    const throwStorage = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
    };
    setMockLocalStorage(throwStorage);
    (globalThis as Record<string, unknown>).window = {
      localStorage: throwStorage,
      matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: light)' }),
    };

    const btn = new MockButton();
    initThemeToggle(btn as unknown as HTMLButtonElement, [], root);

    // Sistem terang terdeteksi walau storage diblokir; link fallback Task 6/docs langsung menjadi terang.
    assert.equal(docElement.dataset.theme, 'light');
    assert.equal(btn.textContent, 'Tema: Terang');
    assert.equal(links[0]!.dataset.transitionCanvas, THEME_CANVAS.light);
    assert.equal(links[1]!.dataset.transitionCanvas, THEME_CANVAS.light);
    assert.equal(links[2]!.dataset.transitionCanvas, '#0b0b0b');

    // Klik sakelar tema saat storage melempar error tetap mengubah DOM & fallback tautan tanpa crash.
    btn.click();
    assert.equal(docElement.dataset.theme, 'dark');
    assert.equal(btn.textContent, 'Tema: Gelap');
    assert.equal(links[0]!.dataset.transitionCanvas, THEME_CANVAS.dark);
    assert.equal(links[1]!.dataset.transitionCanvas, THEME_CANVAS.dark);
    assert.equal(links[2]!.dataset.transitionCanvas, '#0b0b0b');

    // Uji dengan storage tersedia penuh: kedua pageId canvas tersimpan dalam kxrumii:canvas:v1.
    const workingStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    setMockLocalStorage(workingStorage);
    (globalThis as Record<string, unknown>).window = {
      localStorage: workingStorage,
      matchMedia: () => ({ matches: false }),
    };

    applyTheme('light', true, root);
    assert.equal(store.get('kxrumii:pertemuan-6:theme'), 'light');
    const canvasMap = JSON.parse(store.get('kxrumii:canvas:v1') ?? '{}') as Record<string, string>;
    assert.equal(canvasMap['task-6'], THEME_CANVAS.light);
    assert.equal(canvasMap['task-6-docs'], THEME_CANVAS.light);
    assert.equal(links[0]!.dataset.transitionCanvas, THEME_CANVAS.light);
    assert.equal(links[2]!.dataset.transitionCanvas, '#0b0b0b');
  });
});
