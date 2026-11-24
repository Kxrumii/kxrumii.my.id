import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  READER_CLOSE_FALLBACK_MS,
  bindBridgeCancellation,
  canAnimate,
  computeViewportClipInset,
  createDeleteCoordinator,
  createMotionRegistry,
  type RectLike,
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
  rect: RectLike = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };

  getBoundingClientRect(): RectLike {
    const { left, top, width, height } = this.rect;
    return {
      left,
      top,
      width,
      height,
      right: this.rect.right ?? left + width,
      bottom: this.rect.bottom ?? top + height,
    };
  }

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

function createReaderFixture(options: { getSourceElement?: (taskId: number) => HTMLElement | null } = {}) {
  const root = new MockHTMLElement();
  const dialog = new MockHTMLDialogElement();
  dialog.id = 'reader-dialog';
  dialog.className = 'reader-dialog';

  const bar = new MockHTMLElement();
  bar.className = 'reader-bar';

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
  bar.children.push(indexEl, closeBtn);
  dialog.children.push(bar, article);
  root.children.push(dialog);

  const toggleCalls: number[] = [];
  const reader: ReaderDialog = initReaderDialog(root as unknown as ParentNode, {
    onToggle: (id) => toggleCalls.push(id),
    onEdit: () => {},
    onDelete: () => {},
    getSourceElement: options.getSourceElement,
  });

  return {
    dialog,
    bar,
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
      innerWidth: 1280,
      innerHeight: 800,
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

  describe('CP2 Task Card <-> Reader Dialog Continuity', () => {
    it('computeViewportClipInset menghitung inset terhadap dialogRect & viewport, serta menolak geometri tidak valid', () => {
      const viewport = { left: 0, top: 0, width: 1280, height: 800 };
      const dialogFull = { left: 0, top: 0, width: 1280, height: 800 };

      // Rect valid standar
      const valid = computeViewportClipInset(
        { left: 100, top: 200, width: 400, height: 150 },
        dialogFull,
        viewport,
      );
      assert.ok(valid !== null);
      assert.equal(valid.top, 200);
      assert.equal(valid.left, 100);
      assert.equal(valid.right, 780);
      assert.equal(valid.bottom, 450);
      assert.equal(valid.clipPath, 'inset(200.0px 780.0px 450.0px 100.0px)');

      // Dialog yang tidak dimulai dari (0, 0)
      const offsetDialog = { left: 100, top: 60, width: 900, height: 700 };
      const offsetClip = computeViewportClipInset(
        { left: 250, top: 160, width: 300, height: 200 },
        offsetDialog,
        viewport,
      );
      assert.ok(offsetClip !== null);
      assert.equal(offsetClip.left, 150);
      assert.equal(offsetClip.top, 100);
      assert.equal(offsetClip.right, 450);
      assert.equal(offsetClip.bottom, 400);

      // Rect terpotong sebagian oleh batas atas viewport (top < 0)
      const partial = computeViewportClipInset(
        { left: 80, top: -40, width: 300, height: 160 },
        dialogFull,
        viewport,
      );
      assert.ok(partial !== null);
      assert.equal(partial.top, 0);
      assert.equal(partial.bottom, 680);

      // Di luar viewport seluruhnya, ukuran 0, NaN, atau irisan terlalu tipis (< 8px) -> null
      assert.equal(
        computeViewportClipInset({ left: 80, top: 820, width: 300, height: 160 }, dialogFull, viewport),
        null,
      );
      assert.equal(
        computeViewportClipInset({ left: 80, top: 100, width: 0, height: 160 }, dialogFull, viewport),
        null,
      );
      assert.equal(
        computeViewportClipInset({ left: 80, top: 100, width: 300, height: 0 }, dialogFull, viewport),
        null,
      );
      assert.equal(
        computeViewportClipInset({ left: Number.NaN, top: 100, width: 200, height: 100 }, dialogFull, viewport),
        null,
      );
      assert.equal(
        computeViewportClipInset({ left: 80, top: -95, width: 200, height: 100 }, dialogFull, viewport),
        null,
      );
    });

    it('membuka dari List/Orbit memakai rect-to-sheet clip-path reveal dan membersihkan seluruh animasi saat selesai', async () => {
      const source1 = new MockHTMLElement();
      source1.rect = { left: 64, top: 180, width: 520, height: 140 };
      const source2 = new MockHTMLElement();
      source2.rect = { left: 720, top: 240, width: 180, height: 220 };

      const sources = new Map<number, HTMLElement>([
        [1, source1 as unknown as HTMLElement],
        [2, source2 as unknown as HTMLElement],
      ]);

      const fix = createReaderFixture({
        getSourceElement: (id) => sources.get(id) ?? null,
      });
      fix.dialog.rect = { left: 0, top: 0, width: 1280, height: 800 };

      const today = new Date(2026, 10, 24);
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      assert.equal(fix.dialog.open, true);
      assert.equal(recordedAnimations.length, 2);

      const dlgOpenAnim = recordedAnimations[0]!;
      const artOpenAnim = recordedAnimations[1]!;
      assert.equal(dlgOpenAnim.target, fix.dialog);
      assert.equal(
        (dlgOpenAnim.keyframes as Keyframe[])[0]?.clipPath,
        'inset(180.0px 696.0px 480.0px 64.0px)',
      );
      assert.equal((dlgOpenAnim.keyframes as Keyframe[])[1]?.clipPath, 'inset(0px 0px 0px 0px)');
      assert.equal(artOpenAnim.target, fix.article);

      await dlgOpenAnim.finishNow();
      await artOpenAnim.finishNow();
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);

      // Tutup tugas 1 lalu buka & tutup dari kartu tugas 2 (dari Orbit)
      fix.closeBtn.click();
      await recordedAnimations[2]!.finishNow();
      assert.equal(fix.dialog.open, false);

      fix.reader.open(2, sampleTasks, sampleTasks, () => source2 as unknown as HTMLElement, today);
      await recordedAnimations[5]!.finishNow();
      await recordedAnimations[6]!.finishNow();

      fix.closeBtn.click();
      assert.equal(recordedAnimations.length, 10);
      assert.equal(fix.dialog.dataset.readerClosing, 'true');
      const dlgCloseAnim = recordedAnimations[7]!;
      const barCloseAnim = recordedAnimations[8]!;
      const artCloseAnim = recordedAnimations[9]!;
      assert.equal(dlgCloseAnim.target, fix.dialog);
      assert.equal(dlgCloseAnim.options.duration, 260);
      assert.equal(
        (dlgCloseAnim.keyframes as Keyframe[])[2]?.clipPath,
        'inset(240.0px 380.0px 340.0px 720.0px)',
      );
      assert.equal(barCloseAnim.target, fix.bar);
      assert.equal(artCloseAnim.target, fix.article);

      await dlgCloseAnim.finishNow();
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.dataset.readerClosing, undefined);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.bar.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);
      assert.equal(activeElementRef, source2);
    });

    it('setelah Prev/Next menargetkan kartu tugas baru saat ditutup, atau memakai fallback M2 bila sumber tidak tersedia', async () => {
      const source1 = new MockHTMLElement();
      source1.rect = { left: 64, top: 180, width: 520, height: 140 };
      const source2 = new MockHTMLElement();
      source2.rect = { left: 680, top: 180, width: 520, height: 140 };

      const sources = new Map<number, HTMLElement>([
        [1, source1 as unknown as HTMLElement],
        [2, source2 as unknown as HTMLElement],
      ]);

      const fix = createReaderFixture({
        getSourceElement: (id) => sources.get(id) ?? null,
      });
      fix.dialog.rect = { left: 0, top: 0, width: 1280, height: 800 };

      const today = new Date(2026, 10, 24);
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      await recordedAnimations[0]!.finishNow();
      await recordedAnimations[1]!.finishNow();

      // Next ke tugas 2 (menjalankan animasi arah artikel, bukan morph dialog)
      fix.nextBtn.click();
      assert.equal(fix.reader.currentTaskId(), 2);
      assert.equal(recordedAnimations[2]!.target, fix.article);
      await recordedAnimations[2]!.finishNow();

      // Close -> menargetkan rect tugas 2 (left: 680), bukan tugas 1!
      fix.closeBtn.click();
      const closeTo2 = recordedAnimations[3]!;
      assert.equal(
        (closeTo2.keyframes as Keyframe[])[2]?.clipPath,
        'inset(180.0px 80.0px 480.0px 680.0px)',
      );
      await closeTo2.finishNow();
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.bar.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);

      // Buka tugas 1 lalu Next ke tugas 3 (tanpa sumber di Map) -> fallback M2 saat tutup
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      await recordedAnimations[6]!.finishNow();
      await recordedAnimations[7]!.finishNow();
      fix.nextBtn.click();
      fix.nextBtn.click();
      assert.equal(fix.reader.currentTaskId(), 3);
      fix.closeBtn.click();
      const fallbackClose = recordedAnimations[recordedAnimations.length - 1]!;
      assert.equal(fallbackClose.target, fix.dialog);
      assert.equal((fallbackClose.keyframes as Keyframe[])[1]?.transform, 'translate3d(0, 8px, 0)');
      await fallbackClose.finishNow();
      assert.equal(fix.dialog.open, false);
    });

    it('menangani 3x siklus buka/tutup, tutup saat opening, buka saat closing, double-Escape, fallback timer, exit-start, dan reduced motion', async () => {
      const source1 = new MockHTMLElement();
      source1.rect = { left: 80, top: 200, width: 420, height: 150 };
      const fix = createReaderFixture({
        getSourceElement: () => source1 as unknown as HTMLElement,
      });
      fix.dialog.rect = { left: 0, top: 0, width: 1280, height: 800 };
      const today = new Date(2026, 10, 24);

      // 1. 3x siklus open -> close -> reopen berturut-turut
      for (let i = 0; i < 3; i += 1) {
        fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
        assert.equal(fix.dialog.open, true);
        assert.equal(fix.dialog.dataset.readerClosing, undefined);
        const openDlg = recordedAnimations[recordedAnimations.length - 2]!;
        const openArt = recordedAnimations[recordedAnimations.length - 1]!;
        await openDlg.finishNow();
        await openArt.finishNow();
        fix.closeBtn.click();
        assert.equal(fix.dialog.dataset.readerClosing, 'true');
        const closeDlg = recordedAnimations[recordedAnimations.length - 3]!;
        await closeDlg.finishNow();
        assert.equal(fix.dialog.open, false);
        assert.equal(fix.dialog.dataset.readerClosing, undefined);
        assert.equal(fix.dialog.getAnimations().length, 0);
        assert.equal(fix.bar.getAnimations().length, 0);
        assert.equal(fix.article.getAnimations().length, 0);
      }

      // 2. Tutup saat animasi buka masih berjalan
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      const midOpenDlg = recordedAnimations[recordedAnimations.length - 2]!;
      const midOpenArt = recordedAnimations[recordedAnimations.length - 1]!;
      fix.closeBtn.click();
      assert.equal(midOpenDlg.cancelled, true);
      assert.equal(midOpenArt.cancelled, true);
      const midCloseDlg = recordedAnimations[recordedAnimations.length - 3]!;
      await midCloseDlg.finishNow();
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.bar.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);

      // 3. Buka ulang saat animasi tutup bersama masih berjalan
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      fix.closeBtn.click();
      const interruptedCloseDlg = recordedAnimations[recordedAnimations.length - 3]!;
      const interruptedCloseBar = recordedAnimations[recordedAnimations.length - 2]!;
      const interruptedCloseArt = recordedAnimations[recordedAnimations.length - 1]!;
      fix.reader.open(2, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      assert.equal(interruptedCloseDlg.cancelled, true);
      assert.equal(interruptedCloseBar.cancelled, true);
      assert.equal(interruptedCloseArt.cancelled, true);
      assert.equal(fix.dialog.dataset.readerClosing, undefined);
      assert.equal(fix.dialog.open, true);
      await interruptedCloseDlg.finishNow();
      assert.equal(fix.dialog.open, true);

      // 4. Double-Escape saat menutup
      fix.dialog.dispatchEvent(new MockEvent('cancel'));
      assert.equal(fix.dialog.open, true);
      fix.dialog.dispatchEvent(new MockEvent('cancel'));
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.dataset.readerClosing, undefined);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.bar.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);

      // 5. Fallback timer terikat (400ms >= 260ms) saat animasi tutup bersama macet
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      const timerCountBefore = scheduledTimers.length;
      fix.closeBtn.click();
      assert.equal(scheduledTimers.length, timerCountBefore + 1);
      assert.equal(scheduledTimers[scheduledTimers.length - 1]!.ms, 400);
      scheduledTimers[scheduledTimers.length - 1]!.fn();
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.dataset.readerClosing, undefined);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.bar.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);

      // 6. Reduced motion: 0 animasi walau sumber valid
      reducedMotionEnabled = true;
      const animCountBeforeRm = recordedAnimations.length;
      fix.reader.open(1, sampleTasks, sampleTasks, () => source1 as unknown as HTMLElement, today);
      assert.equal(fix.dialog.open, true);
      assert.equal(recordedAnimations.length, animCountBeforeRm);
      fix.closeBtn.click();
      assert.equal(fix.dialog.open, false);
      assert.equal(recordedAnimations.length, animCountBeforeRm);
      assert.equal(activeElementRef, source1);
      reducedMotionEnabled = false;
    });

    it('exit-start selama opening atau closing bersama menutup Reader tanpa memulihkan fokus dan tanpa sisa animasi', () => {
      class MockCustomEvent extends MockEvent {
        detail: unknown;
        constructor(type: string, init: { detail?: unknown } = {}) {
          super(type);
          this.detail = init.detail;
        }
      }

      const source1 = new MockHTMLElement();
      source1.rect = { left: 80, top: 200, width: 420, height: 150 };
      const fix = createReaderFixture({
        getSourceElement: () => source1 as unknown as HTMLElement,
      });
      fix.dialog.rect = { left: 0, top: 0, width: 1280, height: 800 };

      const registry = createMotionRegistry();
      const eventBus = new MockHTMLElement();
      const unbind = bindBridgeCancellation(eventBus as unknown as EventTarget, registry, [
        () => {
          if (fix.reader.isOpen()) fix.reader.close(false);
        },
      ]);

      const today = new Date(2026, 10, 24);
      const trigger = new MockHTMLButtonElement();

      // Kasus A: exit-start saat opening masih berjalan
      activeElementRef = null;
      fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
      eventBus.dispatchEvent(new MockCustomEvent('kxrumii:transition', { detail: { phase: 'exit-start' } }));
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);
      assert.notEqual(activeElementRef, trigger);

      // Kasus B: exit-start saat closing bersama masih berjalan
      activeElementRef = null;
      fix.reader.open(1, sampleTasks, sampleTasks, () => trigger as unknown as HTMLElement, today);
      fix.closeBtn.click();
      eventBus.dispatchEvent(new MockCustomEvent('kxrumii:transition', { detail: { phase: 'exit-start' } }));
      assert.equal(fix.dialog.open, false);
      assert.equal(fix.dialog.getAnimations().length, 0);
      assert.equal(fix.article.getAnimations().length, 0);
      assert.notEqual(activeElementRef, trigger);

      unbind();
    });
  });
});
