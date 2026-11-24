import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  DELETE_FALLBACK_MS,
  STAGGER_MAX_ITEMS,
  STAGGER_STEP_MS,
  bindBridgeCancellation,
  computeStaggerDelays,
  createDeleteCoordinator,
  createMotionRegistry,
  resolveReaderBoundaryFocus,
  shouldAnimate,
  taskDialogOpenKeyframes,
  type AnimationLike,
} from '../src/motion.ts';
import {
  markOrbitNodeExiting,
  reconcileOrbitalStage,
  restoreOrbitNodeActive,
} from '../src/render.ts';
import type { Task } from '../src/types.ts';

function deferredAnimation(): {
  anim: AnimationLike;
  cancelled: () => boolean;
  resolve: () => void;
  reject: (err?: unknown) => void;
} {
  let isCancelled = false;
  let res!: () => void;
  let rej!: (err?: unknown) => void;
  const finished = new Promise<void>((r, j) => {
    res = r;
    rej = j;
  });
  return {
    anim: {
      finished,
      cancel() {
        isCancelled = true;
        rej(new Error('AbortError'));
      },
    },
    cancelled: () => isCancelled,
    resolve: () => res(),
    reject: (err) => rej(err),
  };
}

describe('shouldAnimate (central motion guard)', () => {
  it('hanya mengizinkan gerak bila reducedMotion=false, transitionActive=false, dan supportsAnimate=true', () => {
    assert.equal(shouldAnimate({ reducedMotion: false, transitionActive: false, supportsAnimate: true }), true);
    assert.equal(shouldAnimate({ reducedMotion: true, transitionActive: false, supportsAnimate: true }), false);
    assert.equal(shouldAnimate({ reducedMotion: false, transitionActive: true, supportsAnimate: true }), false);
    assert.equal(shouldAnimate({ reducedMotion: false, transitionActive: false, supportsAnimate: false }), false);
  });
});

describe('computeStaggerDelays', () => {
  it('memakai jeda 24ms hingga maksimal 8 item dan mengembalikan null setelah indeks 7', () => {
    assert.deepEqual(computeStaggerDelays(0), []);
    assert.deepEqual(computeStaggerDelays(1), [0]);
    assert.deepEqual(computeStaggerDelays(8), [0, 24, 48, 72, 96, 120, 144, 168]);

    const thirty = computeStaggerDelays(30, STAGGER_STEP_MS, STAGGER_MAX_ITEMS);
    assert.equal(thirty.length, 30);
    assert.equal(thirty[7], 168);
    for (let i = 8; i < 30; i += 1) {
      assert.equal(thirty[i], null);
    }
  });
});

describe('createMotionRegistry (grup, pembatalan, dan pembersihan)', () => {
  it('mendaftarkan dan membatalkan animasi per grup serta seluruh grup', () => {
    const registry = createMotionRegistry();
    const a = deferredAnimation();
    const b = deferredAnimation();
    const c = deferredAnimation();

    registry.register('orbit-enter', a.anim);
    registry.register('orbit-enter', b.anim);
    registry.register('list-stagger', c.anim);
    assert.equal(registry.activeCount('orbit-enter'), 2);
    assert.equal(registry.activeCount(), 3);

    registry.cancelGroup('orbit-enter');
    assert.equal(a.cancelled(), true);
    assert.equal(b.cancelled(), true);
    assert.equal(c.cancelled(), false);
    assert.equal(registry.activeCount('orbit-enter'), 0);
    assert.equal(registry.activeCount(), 1);

    registry.cancelAll();
    assert.equal(c.cancelled(), true);
    assert.equal(registry.activeCount(), 0);
  });

  it('mengganti animasi pada target yang sama membatalkan animasi sebelumnya', () => {
    const registry = createMotionRegistry();
    const target = {};
    const first = deferredAnimation();
    const second = deferredAnimation();

    registry.register('reader', first.anim, target);
    registry.register('reader', second.anim, target);

    assert.equal(first.cancelled(), true);
    assert.equal(second.cancelled(), false);
    assert.equal(registry.activeCount('reader'), 1);

    registry.cancelAll();
  });

  it('menghapus animasi selesai dari registry dan aman terhadap finished promise yang reject', async () => {
    const registry = createMotionRegistry();
    const done = deferredAnimation();
    const failed = deferredAnimation();

    registry.register('status', done.anim);
    registry.register('add', failed.anim);
    assert.equal(registry.activeCount(), 2);

    done.resolve();
    failed.reject(new Error('AbortError'));
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(registry.activeCount(), 0);

    // Pembatalan ulang saat animasi sudah selesai tidak melempar error
    const alreadyDone: AnimationLike = {
      finished: Promise.resolve(),
      cancel() {
        throw new Error('InvalidStateError');
      },
    };
    registry.register('task-dialog', alreadyDone);
    assert.doesNotThrow(() => registry.cancelGroup('task-dialog'));
  });
});

describe('bindBridgeCancellation (integrasi Shared Transition Bridge)', () => {
  it('membatalkan seluruh motion CP2 dan menjalankan flush hanya saat fase exit-start', () => {
    const registry = createMotionRegistry();
    const target = new EventTarget();
    const anim = deferredAnimation();
    registry.register('orbit-enter', anim.anim);

    let flushCalls = 0;
    const flushes = [
      () => {
        flushCalls += 1;
      },
      () => {
        throw new Error('flush failure ignored');
      },
      () => {
        flushCalls += 1;
      },
    ];

    const unbind = bindBridgeCancellation(target, registry, flushes);

    // Fase lain tidak membatalkan
    target.dispatchEvent(new CustomEvent('kxrumii:transition', { detail: { phase: 'enter-start' } }));
    assert.equal(anim.cancelled(), false);
    assert.equal(flushCalls, 0);

    // Fase exit-start membatalkan semua dan memanggil semua flush
    target.dispatchEvent(new CustomEvent('kxrumii:transition', { detail: { phase: 'exit-start' } }));
    assert.equal(anim.cancelled(), true);
    assert.equal(registry.activeCount(), 0);
    assert.equal(flushCalls, 2);

    unbind();
    const afterUnbind = deferredAnimation();
    registry.register('add', afterUnbind.anim);
    target.dispatchEvent(new CustomEvent('kxrumii:transition', { detail: { phase: 'exit-start' } }));
    assert.equal(afterUnbind.cancelled(), false);
    registry.cancelAll();
  });
});

describe('createDeleteCoordinator (persist-first, fallback 300ms, dan flush)', () => {
  it('menyimpan data secara sinkron sebelum animasi dan memulihkan fokus setelah render akhir', () => {
    const coordinator = createDeleteCoordinator();
    const log: string[] = [];
    let completeAnim!: () => void;

    coordinator.start({
      persist: () => log.push('persist'),
      hasTarget: true,
      runExitAnimation(onComplete) {
        log.push('animate-start');
        completeAnim = onComplete;
        return () => log.push('animate-cancel');
      },
      render: () => log.push('render'),
      restoreFocus: () => log.push('focus'),
      announce: () => log.push('announce'),
      setTimer: () => 1,
      clearTimer: () => log.push('clear-timer'),
    });

    assert.deepEqual(log, ['persist', 'animate-start']);
    assert.equal(coordinator.isPending(), true);

    completeAnim();
    // Pemanggilan ganda callback tidak dieksekusi dua kali
    completeAnim();
    assert.deepEqual(log, [
      'persist',
      'animate-start',
      'clear-timer',
      'animate-cancel',
      'render',
      'focus',
      'announce',
    ]);
    assert.equal(coordinator.isPending(), false);
  });

  it('menjalankan fallback timeout 300ms jika animasi tidak selesai', () => {
    const coordinator = createDeleteCoordinator();
    const log: string[] = [];
    let scheduledMs = 0;
    let timerCallback!: () => void;

    coordinator.start({
      persist: () => log.push('persist'),
      hasTarget: true,
      runExitAnimation: () => () => log.push('cancel'),
      render: () => log.push('render'),
      restoreFocus: () => log.push('focus'),
      announce: () => log.push('announce'),
      setTimer: (fn, ms) => {
        scheduledMs = ms;
        timerCallback = fn;
        return 77;
      },
      clearTimer: (id) => log.push(`clear-${id}`),
    });

    assert.equal(scheduledMs, DELETE_FALLBACK_MS);
    timerCallback();
    assert.deepEqual(log, ['persist', 'clear-77', 'cancel', 'render', 'focus', 'announce']);
    assert.equal(coordinator.isPending(), false);
  });

  it('flush(false) membatalkan animasi saat transisi/interupsi tanpa mencuri fokus', () => {
    const coordinator = createDeleteCoordinator();
    const log: string[] = [];
    let clearedId = 0;

    coordinator.start({
      persist: () => log.push('persist'),
      hasTarget: true,
      runExitAnimation: () => () => log.push('cancel'),
      render: () => log.push('render'),
      restoreFocus: () => log.push('focus'),
      announce: () => log.push('announce'),
      setTimer: () => 99,
      clearTimer: (id) => {
        clearedId = id;
      },
    });

    coordinator.flush(false);
    assert.equal(clearedId, 99);
    assert.deepEqual(log, ['persist', 'cancel', 'render', 'announce']);
    assert.equal(coordinator.isPending(), false);
  });

  it('penghapusan beruntun atau target di luar DOM langsung menyinkronkan state dan fokus', () => {
    const coordinator = createDeleteCoordinator();
    const log: string[] = [];

    coordinator.start({
      persist: () => log.push('persist-1'),
      hasTarget: true,
      runExitAnimation: () => () => log.push('cancel-1'),
      render: () => log.push('render-1'),
      restoreFocus: () => log.push('focus-1'),
      announce: () => log.push('announce-1'),
      setTimer: () => 11,
      clearTimer: () => {},
    });

    // Hapus kedua sebelum pertama selesai (atau target tidak ada di DOM)
    coordinator.start({
      persist: () => log.push('persist-2'),
      hasTarget: false,
      runExitAnimation: () => {
        throw new Error('should not animate when hasTarget=false');
      },
      render: () => log.push('render-2'),
      restoreFocus: () => log.push('focus-2'),
      announce: () => log.push('announce-2'),
    });

    assert.deepEqual(log, [
      'persist-1',
      'cancel-1',
      'render-1',
      'announce-1',
      'persist-2',
      'render-2',
      'focus-2',
      'announce-2',
    ]);
    assert.equal(coordinator.isPending(), false);
  });
});

describe('dialog motion & boundary focus helpers', () => {
  it('menghasilkan keyframe masuk Task/Delete Dialog untuk desktop (10px) dan mobile sheet (24px)', () => {
    assert.deepEqual(taskDialogOpenKeyframes(false), [
      { transform: 'translate3d(0, 10px, 0)', opacity: 0 },
      { transform: 'translate3d(0, 0, 0)', opacity: 1 },
    ]);
    assert.deepEqual(taskDialogOpenKeyframes(true), [
      { transform: 'translate3d(0, 24px, 0)', opacity: 0 },
      { transform: 'translate3d(0, 0, 0)', opacity: 1 },
    ]);
  });

  it('memindahkan fokus Reader Dialog dari tombol prev/next yang menjadi disabled ke tombol lawan atau Tutup', () => {
    assert.equal(resolveReaderBoundaryFocus('prev', true, false), 'next');
    assert.equal(resolveReaderBoundaryFocus('prev', true, true), 'close');
    assert.equal(resolveReaderBoundaryFocus('prev', false, false), null);
    assert.equal(resolveReaderBoundaryFocus('next', false, true), 'prev');
    assert.equal(resolveReaderBoundaryFocus('next', true, true), 'close');
    assert.equal(resolveReaderBoundaryFocus('next', false, false), null);
  });
});

describe('reconcileOrbitalStage (keyed DOM & invariants)', () => {
  class MockElement {
    tagName: string;
    className = '';
    dataset: Record<string, string | undefined> = {};
    attributes = new Map<string, string>();
    children: MockElement[] = [];
    parent: MockElement | null = null;
    textContent: string | null = '';
    disabled = false;
    tabIndex = 0;
    style: Record<string, string> = {};

    constructor(tagName: string) {
      this.tagName = tagName.toUpperCase();
    }

    setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }

    removeAttribute(name: string): void {
      this.attributes.delete(name);
    }

    hasAttribute(name: string): boolean {
      return this.attributes.has(name);
    }

    append(...nodes: MockElement[]): void {
      for (const node of nodes) {
        if (node.parent) {
          node.parent.children = node.parent.children.filter((c) => c !== node);
        }
        node.parent = this;
        this.children.push(node);
      }
    }

    replaceChildren(...nodes: MockElement[]): void {
      for (const child of this.children) child.parent = null;
      this.children = [];
      this.append(...nodes);
    }

    remove(): void {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
    }

    cloneNode(deep = false): MockElement {
      const copy = new (this.constructor as typeof MockElement)(this.tagName);
      copy.className = this.className;
      copy.dataset = { ...this.dataset };
      copy.attributes = new Map(this.attributes);
      copy.textContent = this.textContent;
      if (deep) {
        for (const child of this.children) {
          copy.append(child.cloneNode(true));
        }
      }
      return copy;
    }

    matches(selector: string): boolean {
      const slotMatch = /^\[data-slot="([^"]+)"\]$/.exec(selector);
      if (slotMatch) return this.attributes.get('data-slot') === slotMatch[1];
      if (selector === '.task-box[data-task-id]') {
        return this.className.split(/\s+/).includes('task-box') && this.dataset.taskId !== undefined;
      }
      if (selector === '.box-caption[data-caption-for]') {
        return this.className.split(/\s+/).includes('box-caption') && this.dataset.captionFor !== undefined;
      }
      return false;
    }

    querySelector(selector: string): MockElement | null {
      for (const child of this.children) {
        if (child.matches(selector)) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    }

    querySelectorAll(selector: string): MockElement[] {
      const out: MockElement[] = [];
      for (const child of this.children) {
        if (child.matches(selector)) out.push(child);
        out.push(...child.querySelectorAll(selector));
      }
      return out;
    }
  }

  class MockHTMLElement extends MockElement {}
  class MockHTMLButtonElement extends MockHTMLElement {}

  const savedGlobals = {
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
    document: globalThis.document,
  };

  function createTemplate(): HTMLTemplateElement {
    const box = new MockHTMLButtonElement('button');
    box.className = 'task-box';
    const print = new MockHTMLElement('span');
    print.className = 'box-print';
    for (const slotName of ['head', 'lines', 'deadline', 'urgency']) {
      const slotEl = new MockHTMLElement('span');
      slotEl.setAttribute('data-slot', slotName);
      print.append(slotEl);
    }
    box.append(print);
    return {
      content: { firstElementChild: box },
    } as unknown as HTMLTemplateElement;
  }

  const sampleTasks: readonly Task[] = [
    { id: 1, title: 'Basis Data', course: 'BD', deadline: null, status: 'belum-selesai' },
    { id: 2, title: 'Struktur Data', course: 'SD', deadline: null, status: 'belum-selesai' },
    { id: 3, title: 'Jaringan Komputer', course: 'JK', deadline: null, status: 'selesai' },
  ];

  before(() => {
    (globalThis as Record<string, unknown>).HTMLElement = MockHTMLElement;
    (globalThis as Record<string, unknown>).HTMLButtonElement = MockHTMLButtonElement;
    (globalThis as Record<string, unknown>).document = {
      createElement(tag: string) {
        return new MockHTMLElement(tag);
      },
    };
  });

  after(() => {
    (globalThis as Record<string, unknown>).HTMLElement = savedGlobals.HTMLElement;
    (globalThis as Record<string, unknown>).HTMLButtonElement = savedGlobals.HTMLButtonElement;
    (globalThis as Record<string, unknown>).document = savedGlobals.document;
  });

  it('mempertahankan node bertahan, memasangkan caption stabil, menandai keluar tanpa transform, dan memulihkan node cepat', () => {
    const stage = new MockHTMLElement('div') as unknown as HTMLElement;
    const template = createTemplate();
    const today = new Date(2026, 10, 24);

    // Render awal 3 tugas
    const first = reconcileOrbitalStage(stage, template, sampleTasks, 1, today, false);
    assert.equal(first.entered.length, 3);
    assert.equal(first.exiting.length, 0);

    const box2 = first.entered[1]!.box;
    const cap2 = first.entered[1]!.caption;
    (box2 as unknown as MockHTMLButtonElement).style.transform = 'translate3d(40px, 12px, 0)';
    (cap2 as unknown as MockHTMLElement).style.transform = 'translate3d(20px, 90px, 0)';

    // Filter menyisakan tugas 1 dan 3; tugas 2 keluar
    const second = reconcileOrbitalStage(stage, template, [sampleTasks[0]!, sampleTasks[2]!], 1, today, false);
    assert.equal(second.updated.length, 2);
    assert.equal(second.entered.length, 0);
    assert.equal(second.exiting.length, 1);
    assert.equal(second.exiting[0]!.id, 2);
    assert.equal(second.exiting[0]!.box, box2);
    assert.equal(box2.dataset.exiting, 'true');
    assert.equal(box2.hasAttribute('inert'), true);
    assert.equal(box2.disabled, true);
    assert.equal(box2.tabIndex, -1);
    assert.equal(cap2.dataset.captionFor, '2');
    // Transform luar tetap tidak disentuh selama exit
    assert.equal((box2 as unknown as MockHTMLButtonElement).style.transform, 'translate3d(40px, 12px, 0)');
    assert.equal((cap2 as unknown as MockHTMLElement).style.transform, 'translate3d(20px, 90px, 0)');

    // Ketikan search cepat memulihkan tugas 2 sebelum selesai keluar: tanpa duplikat node!
    const third = reconcileOrbitalStage(stage, template, sampleTasks, 1, today, false);
    assert.equal(third.restored.length, 1);
    assert.equal(third.restored[0]!.box, box2);
    assert.equal(third.restored[0]!.caption, cap2);
    assert.equal(box2.dataset.exiting, undefined);
    assert.equal(box2.hasAttribute('inert'), false);
    assert.equal(box2.disabled, false);
    assert.equal(box2.tabIndex, 0);
    assert.equal((stage as unknown as MockHTMLElement).querySelectorAll('.task-box[data-task-id]').length, 3);
    assert.equal((stage as unknown as MockHTMLElement).querySelectorAll('.box-caption[data-caption-for]').length, 3);

    // Mode reduced motion (immediate=true) langsung menghapus node keluar
    const fourth = reconcileOrbitalStage(stage, template, [sampleTasks[0]!], 1, today, true);
    assert.equal(fourth.exiting.length, 0);
    assert.equal((stage as unknown as MockHTMLElement).querySelectorAll('.task-box[data-task-id]').length, 1);
  });

  it('helper markOrbitNodeExiting dan restoreOrbitNodeActive mengelola atribut aksesibilitas secara simetris', () => {
    const box = new MockHTMLButtonElement('button') as unknown as HTMLButtonElement;
    const caption = new MockHTMLElement('span') as unknown as HTMLElement;

    markOrbitNodeExiting(box, caption);
    assert.equal(box.dataset.exiting, 'true');
    assert.equal(box.hasAttribute('aria-hidden'), true);
    assert.equal(box.hasAttribute('inert'), true);
    assert.equal(caption.dataset.exiting, 'true');

    restoreOrbitNodeActive(box, caption);
    assert.equal(box.dataset.exiting, undefined);
    assert.equal(box.hasAttribute('aria-hidden'), false);
    assert.equal(box.hasAttribute('inert'), false);
    assert.equal(caption.dataset.exiting, undefined);
  });
});
