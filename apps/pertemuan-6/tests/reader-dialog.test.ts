import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  READER_CLOSE_FALLBACK_MS,
  bindBridgeCancellation,
  canAnimate,
  createDeleteCoordinator,
  createMotionRegistry,
} from '../src/motion.ts';
import { initReaderDialog, type ReaderDialog } from '../src/reader-dialog.ts';
import type { Task } from '../src/types.ts';

interface TrackedAnimation {
  target: MockElement;
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  options: KeyframeAnimationOptions;
  finished: Promise<void>;
  playState: 'running' | 'finished' | 'idle';
  cancelled: boolean;
  cancel(): void;
  finishNow(): Promise<void>;
}

class MockEvent {
  type: string;
  target: MockElement | null = null;
  defaultPrevented = false;

  constructor(type: string) {
    this.type = type;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

let activeElementRef: MockElement | null = null;

class MockElement {
  id = '';
  className = '';
  textContent: string | null = '';
  hidden = false;
  disabled = false;
  scrollTop = 0;
  dataset: Record<string, string | undefined> = {};
  attributes = new Map<string, string>();
  children: MockElement[] = [];
  listeners = new Map<string, Array<(event: MockEvent) => void>>();
  animations: TrackedAnimation[] = [];

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  addEventListener(type: string, listener: (event: MockEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: MockEvent) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((item) => item !== listener),
    );
  }

  dispatchEvent(event: MockEvent): boolean {
    if (!event.target) event.target = this;
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  focus(): void {
    activeElementRef = this;
  }

  click(): void {
    this.dispatchEvent(new MockEvent('click'));
  }

  animate(keyframes: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions = {}): TrackedAnimation {
    let resolveFinished!: () => void;
    let rejectFinished!: (err?: unknown) => void;
    const finished = new Promise<void>((res, rej) => {
      resolveFinished = res;
      rejectFinished = rej;
    });

    const anim: TrackedAnimation = {
      target: this,
      keyframes,
      options,
      finished,
      playState: 'running',
      cancelled: false,
      cancel: () => {
        if (anim.cancelled) return;
        anim.cancelled = true;
        anim.playState = 'idle';
        this.animations = this.animations.filter((item) => item !== anim);
        rejectFinished(new Error('AbortError'));
      },
      finishNow: async () => {
        if (anim.cancelled) return;
        anim.playState = 'finished';
        const fill = options.fill ?? 'none';
        if (fill !== 'forwards' && fill !== 'both') {
          this.animations = this.animations.filter((item) => item !== anim);
        }
        resolveFinished();
        await Promise.resolve();
        await Promise.resolve();
      },
    };

    this.animations.push(anim);
    recordedAnimations.push(anim);
    return anim;
  }

  getAnimations(): TrackedAnimation[] {
    return [...this.animations];
  }

  matchesSelector(selector: string): boolean {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }

  querySelector(selector: string): MockElement | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

class MockHTMLElement extends MockElement {}
class MockHTMLButtonElement extends MockHTMLElement {}
class MockHTMLDialogElement extends MockHTMLElement {
  open = false;

  showModal(): void {
    this.open = true;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new MockEvent('close'));
  }
}

let recordedAnimations: TrackedAnimation[] = [];
let reducedMotionEnabled = false;
let scheduledTimers: Array<{ id: number; fn: () => void; ms: number; cleared: boolean }> = [];
let nextTimerId = 1;

function createReaderFixture() {
  const root = new MockHTMLElement();
  const dialog = new MockHTMLDialogElement();
  dialog.id = 'reader-dialog';
  dialog.className = 'reader-dialog';

  const article = new MockHTMLElement();
  article.className = 'reader-article';

  const makeEl = <T extends MockElement>(ctor: { new (): T }, id: string, className = ''): T => {
    const el = new ctor();
    el.id = id;
    el.className = className;
    return el;
  };

  const indexEl = makeEl(MockHTMLElement, 'reader-index');
  const closeBtn = makeEl(MockHTMLButtonElement, 'reader-close', 'reader-close');
  const titleEl = makeEl(MockHTMLElement, 'reader-title', 'reader-title');
  const descriptionEl = makeEl(MockHTMLElement, 'reader-description', 'reader-description');
  const courseEl = makeEl(MockHTMLElement, 'reader-course');
  const categoryRowEl = makeEl(MockHTMLElement, 'reader-category-row');
  const categoryEl = makeEl(MockHTMLElement, 'reader-category');
  const deadlineEl = makeEl(MockHTMLElement, 'reader-deadline');
  const urgencyEl = makeEl(MockHTMLElement, 'reader-urgency');
  const statusEl = makeEl(MockHTMLElement, 'reader-status', 'reader-status');
  const toggleBtn = makeEl(MockHTMLButtonElement, 'reader-toggle');
  const editBtn = makeEl(MockHTMLButtonElement, 'reader-edit');
  const deleteBtn = makeEl(MockHTMLButtonElement, 'reader-delete');
  const prevBtn = makeEl(MockHTMLButtonElement, 'reader-prev');
  const nextBtn = makeEl(MockHTMLButtonElement, 'reader-next');

  categoryRowEl.children.push(categoryEl);
  article.children.push(
    titleEl,
    descriptionEl,
    courseEl,
    categoryRowEl,
    deadlineEl,
    urgencyEl,
    statusEl,
    toggleBtn,
    editBtn,
    deleteBtn,
    prevBtn,
    nextBtn,
  );
  dialog.children.push(indexEl, closeBtn, article);
  root.children.push(dialog);

  const toggleCalls: number[] = [];
  const reader: ReaderDialog = initReaderDialog(root as unknown as ParentNode, {
    onToggle: (id) => toggleCalls.push(id),
    onEdit: () => {},
    onDelete: () => {},
  });

  return {
    dialog,
    article,
    indexEl,
    closeBtn,
    titleEl,
    descriptionEl,
    courseEl,
    categoryRowEl,
    categoryEl,
    statusEl,
    toggleBtn,
    prevBtn,
    nextBtn,
    reader,
    toggleCalls,
  };
}

const sampleTasks: readonly Task[] = [
  {
    id: 1,
    title: 'Implementasi Web API',
    course: 'PAW',
    category: 'Praktikum',
    description: 'Catatan lengkap tugas pertama.',
    deadline: '2026-12-01',
    status: 'belum-selesai',
  },
  {
    id: 2,
    title: 'Makalah Arsitektur',
    course: 'RPL',
    deadline: null,
    status: 'selesai',
  },
  {
    id: 3,
    title: 'Uji Integrasi',
    course: 'PPL',
    category: 'Proyek',
    deadline: '2026-12-15',
    status: 'belum-selesai',
  },
];

describe('initReaderDialog (reopen visibility, close animation cleanup & interactions)', () => {
  const savedGlobals = {
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
    HTMLDialogElement: globalThis.HTMLDialogElement,
    window: globalThis.window,
    document: globalThis.document,
  };

  before(() => {
    (globalThis as Record<string, unknown>).Element = MockElement;
    (globalThis as Record<string, unknown>).HTMLElement = MockHTMLElement;
    (globalThis as Record<string, unknown>).HTMLButtonElement = MockHTMLButtonElement;
    (globalThis as Record<string, unknown>).HTMLDialogElement = MockHTMLDialogElement;
    (globalThis as Record<string, unknown>).window = {
      matchMedia: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotionEnabled : false,
      }),
      setTimeout: (fn: () => void, ms = 0) => {
        const entry = { id: nextTimerId++, fn, ms, cleared: false };
        scheduledTimers.push(entry);
        return entry.id;
      },
      clearTimeout: (id: number) => {
        const found = scheduledTimers.find((entry) => entry.id === id);
        if (found) found.cleared = true;
      },
    };
    (globalThis as Record<string, unknown>).document = {
      documentElement: new MockHTMLElement(),
      get activeElement() {
        return activeElementRef;
      },
    };
  });

  after(() => {
    (globalThis as Record<string, unknown>).Element = savedGlobals.Element;
    (globalThis as Record<string, unknown>).HTMLElement = savedGlobals.HTMLElement;
    (globalThis as Record<string, unknown>).HTMLButtonElement = savedGlobals.HTMLButtonElement;
    (globalThis as Record<string, unknown>).HTMLDialogElement = savedGlobals.HTMLDialogElement;
    (globalThis as Record<string, unknown>).window = savedGlobals.window;
    (globalThis as Record<string, unknown>).document = savedGlobals.document;
  });

  beforeEach(() => {
    recordedAnimations = [];
    reducedMotionEnabled = false;
    scheduledTimers = [];
    nextTimerId = 1;
    activeElementRef = null;
  });

  it('membatalkan animasi tutup fill:forwards setelah selesai agar pembukaan ulang tetap terlihat', async () => {
    const fix = createReaderFixture();
    const trigger1 = new MockHTMLButtonElement();
    const trigger2 = new MockHTMLButtonElement();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => trigger1 as unknown as HTMLElement, today);
    assert.equal(fix.dialog.open, true);
    assert.equal(recordedAnimations.length, 1);
    const openAnim1 = recordedAnimations[0]!;
    await openAnim1.finishNow();
    assert.equal(fix.dialog.getAnimations().length, 0);

    // Tutup melalui tombol Tutup: animasi keluar menggunakan fill:forwards ke opacity:0
    fix.closeBtn.click();
    assert.equal(recordedAnimations.length, 2);
    const closeAnim = recordedAnimations[1]!;
    assert.equal(closeAnim.options.fill, 'forwards');

    // Selesaikan animasi tutup: cleanup registry di motion.ts berjalan lebih dulu sebelum finalize()
    await closeAnim.finishNow();
    assert.equal(fix.dialog.open, false);
    assert.equal(closeAnim.cancelled, true);
    assert.equal(fix.dialog.getAnimations().length, 0);
    assert.equal(activeElementRef, trigger1);

    // Buka ulang tugas kedua: tidak boleh ada animasi tutup fill:forwards tersisa
    fix.reader.open(2, sampleTasks, sampleTasks, () => trigger2 as unknown as HTMLElement, today);
    assert.equal(fix.dialog.open, true);
    assert.equal(fix.titleEl.textContent, 'Makalah Arsitektur');
    assert.equal(recordedAnimations.length, 3);
    const openAnim2 = recordedAnimations[2]!;
    await openAnim2.finishNow();
    assert.equal(fix.dialog.getAnimations().length, 0);
  });

  it('pembukaan ulang saat animasi tutup masih berjalan membatalkan penutupan dan tetap menampilkan panel', async () => {
    const fix = createReaderFixture();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => null, today);
    await recordedAnimations[0]!.finishNow();

    fix.closeBtn.click();
    const closeAnim = recordedAnimations[1]!;
    assert.equal(fix.dialog.open, true);

    // Buka kembali tugas 2 sebelum animasi tutup selesai
    fix.reader.open(2, sampleTasks, sampleTasks, () => null, today);
    assert.equal(closeAnim.cancelled, true);
    assert.equal(fix.dialog.open, true);
    assert.equal(fix.titleEl.textContent, 'Makalah Arsitektur');
    // Animasi masuk harus berjalan ulang karena sebelumnya dialog sedang menutup ke opacity:0
    assert.equal(recordedAnimations.length, 3);

    // Penyelesaian promise animasi tutup lama tidak boleh menutup dialog yang baru dibuka
    await closeAnim.finishNow();
    await recordedAnimations[2]!.finishNow();
    assert.equal(fix.dialog.open, true);
    assert.equal(fix.dialog.getAnimations().length, 0);
  });

  it('mendukung Escape animasi keluar dan Escape kedua untuk menutup instan serta bersih', async () => {
    const fix = createReaderFixture();
    const trigger = new MockHTMLButtonElement();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
    await recordedAnimations[0]!.finishNow();

    const esc1 = new MockEvent('cancel');
    fix.dialog.dispatchEvent(esc1);
    assert.equal(esc1.defaultPrevented, true);
    assert.equal(fix.dialog.open, true);
    assert.equal(recordedAnimations.length, 2);
    const closeAnim = recordedAnimations[1]!;

    // Escape kedua saat masih menutup: menutup instan dan membatalkan animasi tutup
    const esc2 = new MockEvent('cancel');
    fix.dialog.dispatchEvent(esc2);
    assert.equal(esc2.defaultPrevented, true);
    assert.equal(fix.dialog.open, false);
    assert.equal(closeAnim.cancelled, true);
    assert.equal(fix.dialog.getAnimations().length, 0);
    assert.equal(activeElementRef, trigger);
  });

  it('menjalankan fallback timeout 300ms bila animasi tutup tidak pernah selesai', () => {
    const fix = createReaderFixture();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => null, today);
    fix.closeBtn.click();
    const closeAnim = recordedAnimations[1]!;
    assert.equal(scheduledTimers.length, 1);
    assert.equal(scheduledTimers[0]!.ms, READER_CLOSE_FALLBACK_MS);

    scheduledTimers[0]!.fn();
    assert.equal(fix.dialog.open, false);
    assert.equal(closeAnim.cancelled, true);
    assert.equal(fix.dialog.getAnimations().length, 0);
  });

  it('mengelola navigasi Sebelumnya/Berikutnya, fokus batas, serta field opsional category/description', () => {
    const fix = createReaderFixture();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => null, today);
    assert.equal(fix.descriptionEl.hidden, false);
    assert.equal(fix.categoryRowEl.hidden, false);
    assert.equal(fix.prevBtn.disabled, true);
    assert.equal(fix.nextBtn.disabled, false);

    // Klik Berikutnya dari tugas 1 -> tugas 2 (tanpa category dan description)
    fix.nextBtn.focus();
    fix.nextBtn.click();
    assert.equal(fix.titleEl.textContent, 'Makalah Arsitektur');
    assert.equal(fix.descriptionEl.hidden, true);
    assert.equal(fix.categoryRowEl.hidden, true);
    assert.equal(fix.prevBtn.disabled, false);
    assert.equal(fix.nextBtn.disabled, false);

    // Klik Berikutnya dari tugas 2 -> tugas 3 (ujung kanan, nextBtn menjadi disabled -> fokus ke prevBtn)
    fix.nextBtn.focus();
    fix.nextBtn.click();
    assert.equal(fix.titleEl.textContent, 'Uji Integrasi');
    assert.equal(fix.nextBtn.disabled, true);
    assert.equal(activeElementRef, fix.prevBtn);

    // Klik Sebelumnya dua kali -> tugas 1 (ujung kiri, prevBtn menjadi disabled -> fokus ke nextBtn)
    fix.prevBtn.focus();
    fix.prevBtn.click();
    fix.prevBtn.focus();
    fix.prevBtn.click();
    assert.equal(fix.titleEl.textContent, 'Implementasi Web API');
    assert.equal(fix.prevBtn.disabled, true);
    assert.equal(activeElementRef, fix.nextBtn);
  });

  it('menghormati prefers-reduced-motion: reduce dan opsi restoreFocus=false pada close()', () => {
    reducedMotionEnabled = true;
    const fix = createReaderFixture();
    const trigger = new MockHTMLButtonElement();
    const today = new Date(2026, 10, 24);

    fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
    assert.equal(fix.dialog.open, true);
    assert.equal(recordedAnimations.length, 0);

    const esc = new MockEvent('cancel');
    fix.dialog.dispatchEvent(esc);
    assert.equal(esc.defaultPrevented, false);

    fix.closeBtn.click();
    assert.equal(fix.dialog.open, false);
    assert.equal(recordedAnimations.length, 0);
    assert.equal(activeElementRef, trigger);

    // close(false) menekan pemulihan fokus (mis. saat transisi rute atau hapus)
    activeElementRef = null;
    fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
    fix.reader.close(false);
    assert.equal(fix.dialog.open, false);
    assert.notEqual(activeElementRef, trigger);
  });

  describe('route exit-start cleanup integration (CP3)', () => {
    class MockCustomEvent extends MockEvent {
      detail: unknown;

      constructor(type: string, init: { detail?: unknown } = {}) {
        super(type);
        this.detail = init.detail;
      }
    }

    it('canAnimate() memblokir gerak saat data-transition-state aktif dan pulih setelah dihapus', () => {
      const docEl = (document as unknown as { documentElement: MockHTMLElement }).documentElement;
      assert.equal(canAnimate(), true);

      docEl.setAttribute('data-transition-state', 'leaving');
      assert.equal(canAnimate(), false);

      docEl.setAttribute('data-transition-state', 'entering');
      assert.equal(canAnimate(), false);

      docEl.removeAttribute('data-transition-state');
      assert.equal(canAnimate(), true);
    });

    it('exit-start membatalkan semua motion, flush delete & timer tanpa memulihkan fokus, menutup Reader, dan aman dipanggil ulang', () => {
      const registry = createMotionRegistry();
      const deleteCoordinator = createDeleteCoordinator();
      const fix = createReaderFixture();
      const trigger = new MockHTMLButtonElement();
      const today = new Date(2026, 10, 24);

      fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
      const readerAnim = recordedAnimations[0]!;
      registry.register('reader', readerAnim, fix.dialog);

      let orbitExited = false;
      const orbitNode = new MockHTMLElement();
      orbitNode.dataset.exiting = 'true';

      let searchTimerFired = false;
      let searchTimerId = window.setTimeout(() => {
        searchTimerFired = true;
      }, 300);

      const log: string[] = [];
      let restoreFocusCalled = 0;
      deleteCoordinator.start({
        persist: () => log.push('persist'),
        hasTarget: true,
        runExitAnimation: () => () => log.push('delete-anim-cancel'),
        render: () => log.push('render'),
        restoreFocus: () => {
          restoreFocusCalled += 1;
        },
        announce: () => log.push('announce'),
      });

      const flushes = [
        () => deleteCoordinator.flush(false),
        () => {
          orbitExited = true;
          delete orbitNode.dataset.exiting;
        },
        () => {
          window.clearTimeout(searchTimerId);
          searchTimerId = 0;
        },
        () => {
          if (fix.reader.isOpen()) fix.reader.close(false);
        },
      ];

      const eventBus = new MockHTMLElement();
      const unbind = bindBridgeCancellation(eventBus as unknown as EventTarget, registry, flushes);

      activeElementRef = null;
      const exitEvent = new MockCustomEvent('kxrumii:transition', {
        detail: { phase: 'exit-start', fromPage: 'task-6', toColor: '#0b0b0b' },
      });
      eventBus.dispatchEvent(exitEvent);

      assert.equal(registry.activeCount(), 0);
      assert.equal(readerAnim.cancelled, true);
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.notEqual(activeElementRef, trigger);
      assert.equal(deleteCoordinator.isPending(), false);
      assert.deepEqual(log, ['persist', 'delete-anim-cancel', 'render', 'announce']);
      assert.equal(restoreFocusCalled, 0);
      assert.equal(orbitExited, true);
      assert.equal(searchTimerId, 0);
      assert.equal(scheduledTimers.every((t) => t.cleared), true);
      assert.equal(searchTimerFired, false);

      // Idempoten: exit-start kedua tidak error atau mengeksekusi callback dua kali
      assert.doesNotThrow(() => eventBus.dispatchEvent(exitEvent));
      assert.deepEqual(log, ['persist', 'delete-anim-cancel', 'render', 'announce']);
      assert.equal(restoreFocusCalled, 0);

      unbind();
    });
  });
});
