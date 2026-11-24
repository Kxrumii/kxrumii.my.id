import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initDocAccordions } from '../src/accordion.ts';
import { bindBridgeCancellation, createMotionRegistry } from '../src/motion.ts';

interface TrackedAnim {
  target: MockAccEl;
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  options: KeyframeAnimationOptions;
  cancelled: boolean;
  finished: Promise<void>;
  cancel(): void;
  finishNow(): Promise<void>;
}

class MockClickEvent {
  type = 'click';
  defaultPrevented = false;
  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class MockAccEl {
  className = '';
  dataset: Record<string, string | undefined> = {};
  style: Record<string, string> = {};
  children: MockAccEl[] = [];
  listeners = new Map<string, Array<(ev: MockClickEvent) => void>>();
  animations: TrackedAnim[] = [];
  offsetHeight = 0;
  scrollHeight = 0;
  heightMeasure = 0;

  getBoundingClientRect(): { height: number } {
    return { height: this.heightMeasure || this.offsetHeight };
  }

  addEventListener(type: string, fn: (ev: MockClickEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: (ev: MockClickEvent) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((f) => f !== fn),
    );
  }

  click(): MockClickEvent {
    const ev = new MockClickEvent();
    for (const fn of this.listeners.get('click') ?? []) {
      fn(ev);
    }
    return ev;
  }

  animate(keyframes: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions = {}): TrackedAnim {
    let res!: () => void;
    let rej!: (err?: unknown) => void;
    const finished = new Promise<void>((r, j) => {
      res = r;
      rej = j;
    });
    const anim: TrackedAnim = {
      target: this,
      keyframes,
      options,
      cancelled: false,
      finished,
      cancel: () => {
        if (anim.cancelled) return;
        anim.cancelled = true;
        this.animations = this.animations.filter((a) => a !== anim);
        rej(new Error('AbortError'));
      },
      finishNow: async () => {
        if (anim.cancelled) return;
        this.animations = this.animations.filter((a) => a !== anim);
        res();
        await Promise.resolve();
        await Promise.resolve();
      },
    };
    this.animations.push(anim);
    recorded.push(anim);
    return anim;
  }

  querySelector(selector: string): MockAccEl | null {
    for (const child of this.children) {
      if (selector === 'summary' && child instanceof MockSummaryEl) return child;
      if (selector === '.note-body' && child.className.split(/\s+/).includes('note-body')) return child;
    }
    return null;
  }
}

class MockDetailsEl extends MockAccEl {
  private _open = false;
  collapsedHeight = 52;
  expandedHeight = 220;

  get open(): boolean {
    return this._open;
  }
  set open(val: boolean) {
    this._open = val;
    this.offsetHeight = val ? this.expandedHeight : this.collapsedHeight;
    this.scrollHeight = val ? this.expandedHeight : this.collapsedHeight;
    if (this.heightMeasure === 0 || this.heightMeasure === this.collapsedHeight || this.heightMeasure === this.expandedHeight) {
      this.heightMeasure = this.offsetHeight;
    }
  }
}

class MockSummaryEl extends MockAccEl {
  offsetHeight = 52;
}

class MockNotePair {
  details: MockDetailsEl;
  summary: MockSummaryEl;
  body: MockAccEl;

  constructor() {
    this.details = new MockDetailsEl();
    this.details.className = 'note';
    this.details.offsetHeight = 52;
    this.details.heightMeasure = 52;

    this.summary = new MockSummaryEl();
    this.body = new MockAccEl();
    this.body.className = 'note-body';
    this.body.offsetHeight = 168;
    this.details.children.push(this.summary, this.body);
  }
}

let recorded: TrackedAnim[] = [];
let reducedMotion = false;

describe('CP4-C initDocAccordions (smooth <details> progressive enhancement)', () => {
  const saved = {
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    window: globalThis.window,
    document: globalThis.document,
  };

  before(() => {
    (globalThis as Record<string, unknown>).Element = MockAccEl;
    (globalThis as Record<string, unknown>).HTMLElement = MockAccEl;
    (globalThis as Record<string, unknown>).window = {
      matchMedia: (q: string) => ({
        matches: q === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      }),
    };
    (globalThis as Record<string, unknown>).document = {
      documentElement: new MockAccEl(),
      hasAttribute: () => false,
    };
    (globalThis.document as unknown as { documentElement: { hasAttribute: () => boolean } }).documentElement.hasAttribute = () => false;
  });

  after(() => {
    (globalThis as Record<string, unknown>).Element = saved.Element;
    (globalThis as Record<string, unknown>).HTMLElement = saved.HTMLElement;
    (globalThis as Record<string, unknown>).window = saved.window;
    (globalThis as Record<string, unknown>).document = saved.document;
  });

  beforeEach(() => {
    recorded = [];
    reducedMotion = false;
  });

  function createRoot(count = 2) {
    const notes = Array.from({ length: count }, () => new MockNotePair());
    const root = {
      querySelectorAll: (sel: string) => (sel === 'details.note' ? notes.map((n) => n.details) : []),
    } as unknown as ParentNode;
    return { root, notes };
  }

  it('membuka dan menutup accordion secara halus, membersihkan height/overflow untuk resize aman', async () => {
    const { root, notes } = createRoot(1);
    const note = notes[0]!;
    const ctrl = initDocAccordions(root);

    // Expand
    const openEv = note.summary.click();
    assert.equal(openEv.defaultPrevented, true);
    assert.equal(note.details.open, true);
    assert.equal(note.details.style.overflow, 'hidden');
    assert.equal(recorded.length, 2);
    assert.deepEqual(recorded[0]!.keyframes, [{ height: '52.0px' }, { height: '220.0px' }]);

    await recorded[0]!.finishNow();
    assert.equal(note.details.style.overflow, '');
    assert.equal(note.details.style.height, '');
    assert.equal(note.details.open, true);

    // Collapse
    const closeEv = note.summary.click();
    assert.equal(closeEv.defaultPrevented, true);
    assert.equal(note.details.dataset.accordionState, 'closing');
    assert.equal(note.details.open, true);
    assert.equal(recorded.length, 4);
    assert.deepEqual(recorded[2]!.keyframes, [{ height: '220.0px' }, { height: '52.0px' }]);

    await recorded[2]!.finishNow();
    assert.equal(note.details.open, false);
    assert.equal(note.details.dataset.accordionState, undefined);
    assert.equal(note.details.style.overflow, '');
    assert.equal(note.details.style.height, '');

    ctrl.destroy();
  });

  it('membalik arah dari tinggi mid-flight dan menjaga multi-accordion independen', async () => {
    const { root, notes } = createRoot(2);
    const [a, b] = notes as [MockNotePair, MockNotePair];
    const ctrl = initDocAccordions(root);

    // Buka A, lalu interupsi di tinggi tengah (140px)
    a.summary.click();
    const expandAnimA = recorded[0]!;
    const expandBodyA = recorded[1]!;

    // Buka B bersamaan -> tidak membatalkan A
    b.summary.click();
    assert.equal(expandAnimA.cancelled, false);
    assert.equal(recorded.length, 4);

    // Klik cepat A lagi saat tinggi visualnya 140px -> berbalik ke collapse dari 140px
    a.details.heightMeasure = 140;
    a.summary.click();
    assert.equal(expandAnimA.cancelled, true);
    assert.equal(expandBodyA.cancelled, true);
    assert.equal(recorded[2]!.cancelled, false);
    const reverseCollapseA = recorded[4]!;
    assert.deepEqual(reverseCollapseA.keyframes, [{ height: '140.0px' }, { height: '52.0px' }]);

    await reverseCollapseA.finishNow();
    await recorded[2]!.finishNow();
    assert.equal(a.details.open, false);
    assert.equal(b.details.open, true);
    assert.equal(a.details.style.height, '');
    assert.equal(b.details.style.height, '');

    ctrl.destroy();
  });

  it('membiarkan toggle native pada reduced motion dan flush() menyelesaikan state saat exit-start', () => {
    const { root, notes } = createRoot(2);
    const [a, b] = notes as [MockNotePair, MockNotePair];
    const ctrl = initDocAccordions(root);

    // A sedang expanding, B sedang closing -> exit-start flush
    a.summary.click();
    b.details.open = true;
    b.summary.click();

    const eventTarget = new MockAccEl();
    const unbind = bindBridgeCancellation(
      {
        addEventListener: eventTarget.addEventListener.bind(eventTarget),
        removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      } as unknown as EventTarget,
      createMotionRegistry(),
      [() => ctrl.flush()],
    );

    for (const fn of eventTarget.listeners.get('kxrumii:transition') ?? []) {
      (fn as unknown as (e: { detail: { phase: string } }) => void)({ detail: { phase: 'exit-start' } });
    }

    assert.equal(a.details.open, true);
    assert.equal(a.details.style.overflow, '');
    assert.equal(b.details.open, false);
    assert.equal(b.details.dataset.accordionState, undefined);
    assert.equal(b.details.style.overflow, '');

    // Reduced motion -> tidak preventDefault dan tidak menjalankan WAAPI baru
    reducedMotion = true;
    const beforeRmCount = recorded.length;
    const evRm = b.summary.click();
    assert.equal(evRm.defaultPrevented, false);
    assert.equal(recorded.length, beforeRmCount);

    unbind();
    ctrl.destroy();
  });
});
