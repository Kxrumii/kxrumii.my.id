import { transitionEvents } from '@kxrumii/transition-bridge';

export type MotionGroup =
  | 'orbit-enter'
  | 'orbit-exit'
  | 'list-stagger'
  | 'add'
  | 'status'
  | 'delete-exit'
  | 'reader'
  | 'task-dialog';

export const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
export const EASE_EXIT = 'cubic-bezier(.45, 0, .2, 1)';
export const STAGGER_STEP_MS = 24;
export const STAGGER_MAX_ITEMS = 8;
export const DELETE_FALLBACK_MS = 300;
export const READER_CLOSE_FALLBACK_MS = 300;

export interface MotionEnv {
  reducedMotion: boolean;
  transitionActive: boolean;
  supportsAnimate: boolean;
}

export interface AnimationLike {
  cancel(): void;
  readonly finished: Promise<unknown>;
  readonly playState?: string;
}

export interface AnimatableTarget {
  animate?: (
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: KeyframeAnimationOptions,
  ) => AnimationLike;
}

export interface MotionRegistry {
  register(group: MotionGroup, animation: AnimationLike, target?: object): void;
  cancelGroup(group: MotionGroup): void;
  cancelAll(): void;
  activeCount(group?: MotionGroup): number;
}

export function readMotionEnv(): MotionEnv {
  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const transitionActive =
    typeof document !== 'undefined' && document.documentElement !== null
      ? document.documentElement.hasAttribute('data-transition-state')
      : false;
  const supportsAnimate =
    typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  return { reducedMotion, transitionActive, supportsAnimate };
}

/** Kebijakan murni apakah animasi aplikasi boleh berjalan. */
export function shouldAnimate(env: MotionEnv): boolean {
  return !env.reducedMotion && !env.transitionActive && env.supportsAnimate;
}

export function canAnimate(overrides?: Partial<MotionEnv>): boolean {
  const env = overrides ? { ...readMotionEnv(), ...overrides } : readMotionEnv();
  return shouldAnimate(env);
}

/**
 * Menghitung jeda stagger (ms) untuk `count` elemen.
 * Elemen setelah indeks `maxItems - 1` mengembalikan `null` (tampil langsung tanpa animasi).
 */
export function computeStaggerDelays(
  count: number,
  stepMs = STAGGER_STEP_MS,
  maxItems = STAGGER_MAX_ITEMS,
): Array<number | null> {
  const safeCount = Math.max(0, Math.trunc(count));
  const safeMax = Math.max(0, Math.trunc(maxItems));
  const safeStep = Math.max(0, stepMs);
  const delays: Array<number | null> = [];
  for (let i = 0; i < safeCount; i += 1) {
    delays.push(i < safeMax ? i * safeStep : null);
  }
  return delays;
}

export function taskDialogOpenKeyframes(isMobileSheet: boolean): Keyframe[] {
  const dy = isMobileSheet ? 24 : 10;
  return [
    { transform: `translate3d(0, ${dy}px, 0)`, opacity: 0 },
    { transform: 'translate3d(0, 0, 0)', opacity: 1 },
  ];
}

/**
 * Menentukan target fokus aman ketika tombol prev/next Reader Dialog menjadi disabled
 * di ujung daftar tugas.
 */
export function resolveReaderBoundaryFocus(
  triggered: 'prev' | 'next',
  prevDisabled: boolean,
  nextDisabled: boolean,
): 'prev' | 'next' | 'close' | null {
  if (triggered === 'prev' && prevDisabled) {
    return nextDisabled ? 'close' : 'next';
  }
  if (triggered === 'next' && nextDisabled) {
    return prevDisabled ? 'close' : 'prev';
  }
  return null;
}

function safeCancel(animation: AnimationLike): void {
  try {
    animation.cancel();
  } catch {
    /* animasi mungkin sudah selesai atau dibatalkan */
  }
}

/** Registry animasi per grup dengan pembersihan otomatis dan tanpa unhandled rejection. */
export function createMotionRegistry(): MotionRegistry {
  const groups = new Map<MotionGroup, Set<AnimationLike>>();
  const targetAnims = new Map<MotionGroup, WeakMap<object, AnimationLike>>();

  function groupSet(group: MotionGroup): Set<AnimationLike> {
    let set = groups.get(group);
    if (!set) {
      set = new Set<AnimationLike>();
      groups.set(group, set);
    }
    return set;
  }

  function groupTargets(group: MotionGroup): WeakMap<object, AnimationLike> {
    let map = targetAnims.get(group);
    if (!map) {
      map = new WeakMap<object, AnimationLike>();
      targetAnims.set(group, map);
    }
    return map;
  }

  function remove(group: MotionGroup, animation: AnimationLike, target?: object): void {
    const set = groups.get(group);
    set?.delete(animation);
    if (target) {
      const map = targetAnims.get(group);
      if (map?.get(target) === animation) {
        map.delete(target);
      }
    }
  }

  return {
    register(group, animation, target): void {
      if (target) {
        const map = groupTargets(group);
        const previous = map.get(target);
        if (previous && previous !== animation) {
          remove(group, previous, target);
          safeCancel(previous);
        }
        map.set(target, animation);
      }
      const set = groupSet(group);
      set.add(animation);
      const cleanup = (): void => remove(group, animation, target);
      void Promise.resolve(animation.finished).then(cleanup, cleanup);
    },
    cancelGroup(group): void {
      const set = groups.get(group);
      if (!set || set.size === 0) {
        targetAnims.delete(group);
        return;
      }
      const list = Array.from(set);
      set.clear();
      targetAnims.delete(group);
      for (const anim of list) {
        safeCancel(anim);
      }
    },
    cancelAll(): void {
      for (const group of Array.from(groups.keys())) {
        this.cancelGroup(group);
      }
    },
    activeCount(group): number {
      if (group !== undefined) {
        return groups.get(group)?.size ?? 0;
      }
      let total = 0;
      for (const set of groups.values()) {
        total += set.size;
      }
      return total;
    },
  };
}

const defaultRegistry = createMotionRegistry();
const transitionFlushCallbacks = new Set<() => void>();

export function registerMotion(group: MotionGroup, animation: AnimationLike, target?: object): void {
  defaultRegistry.register(group, animation, target);
}

export function cancelMotionGroup(group: MotionGroup): void {
  defaultRegistry.cancelGroup(group);
}

export function cancelAllMotion(): void {
  defaultRegistry.cancelAll();
}

export function animateElement(
  group: MotionGroup,
  target: AnimatableTarget | null | undefined,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
  envOverrides?: Partial<MotionEnv>,
): AnimationLike | null {
  if (!target || !canAnimate(envOverrides) || typeof target.animate !== 'function') {
    return null;
  }
  const anim = target.animate(keyframes, options);
  defaultRegistry.register(group, anim, target);
  return anim;
}

export function animateTaskDialogOpen(dialog: HTMLDialogElement): AnimationLike | null {
  const isMobileSheet =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 560px)').matches
      : false;
  return animateElement('task-dialog', dialog, taskDialogOpenKeyframes(isMobileSheet), {
    duration: 180,
    easing: EASE_OUT,
    fill: 'backwards',
  });
}

/** Mendaftarkan callback flush agar dipanggil ketika transisi rute keluar dimulai. */
export function registerTransitionFlush(callback: () => void): () => void {
  transitionFlushCallbacks.add(callback);
  return () => {
    transitionFlushCallbacks.delete(callback);
  };
}

/**
 * Mengikat pembatalan seluruh motion CP2 saat Shared Transition Bridge
 * memancarkan `kxrumii:transition` dengan fase `exit-start`.
 */
export function bindBridgeCancellation(
  target: EventTarget = document,
  registry: MotionRegistry = defaultRegistry,
  flushes: Iterable<() => void> = transitionFlushCallbacks,
): () => void {
  const onTransition = (event: Event): void => {
    const detail = (event as CustomEvent<{ phase?: string }>).detail;
    if (detail?.phase !== 'exit-start') return;
    registry.cancelAll();
    for (const flush of Array.from(flushes)) {
      try {
        flush();
      } catch {
        /* jangan biarkan flush gagal menghentikan pembersihan rute */
      }
    }
  };
  target.addEventListener(transitionEvents.transition, onTransition);
  return () => {
    target.removeEventListener(transitionEvents.transition, onTransition);
  };
}

export interface DeleteCoordinatorOptions {
  persist: () => void;
  hasTarget: boolean;
  runExitAnimation: (onComplete: () => void) => (() => void) | null;
  render: () => void;
  restoreFocus: () => void;
  announce: () => void;
  fallbackMs?: number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface DeleteCoordinator {
  start(options: DeleteCoordinatorOptions): void;
  flush(restoreFocus?: boolean): void;
  isPending(): boolean;
}

/**
 * Koordinator penghapusan persist-first:
 * data selalu disimpan sinkron lebih dulu; animasi keluar bersifat opsional dan
 * dijamin selesai melalui callback animasi, timeout fallback 300ms, atau flush.
 */
export function createDeleteCoordinator(): DeleteCoordinator {
  let activeFlush: ((restoreFocus: boolean) => void) | null = null;

  return {
    start(options): void {
      if (activeFlush) {
        activeFlush(false);
      }

      options.persist();

      if (!options.hasTarget) {
        options.render();
        options.restoreFocus();
        options.announce();
        return;
      }

      const setTimer =
        options.setTimer ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms));
      const clearTimer =
        options.clearTimer ?? ((id: number) => window.clearTimeout(id));
      const fallbackMs = options.fallbackMs ?? DELETE_FALLBACK_MS;

      let settled = false;
      let timerId = 0;
      let cancelAnim: (() => void) | null = null;

      const settle = (shouldRestoreFocus: boolean): void => {
        if (settled) return;
        settled = true;
        if (timerId !== 0) {
          clearTimer(timerId);
          timerId = 0;
        }
        activeFlush = null;
        if (cancelAnim) {
          const cancel = cancelAnim;
          cancelAnim = null;
          try {
            cancel();
          } catch {
            /* abaikan */
          }
        }
        options.render();
        if (shouldRestoreFocus) {
          options.restoreFocus();
        }
        options.announce();
      };

      activeFlush = settle;
      cancelAnim = options.runExitAnimation(() => settle(true));
      if (!cancelAnim) {
        settle(true);
        return;
      }
      if (!settled) {
        timerId = setTimer(() => settle(true), fallbackMs);
      }
    },
    flush(restoreFocus = false): void {
      activeFlush?.(restoreFocus);
    },
    isPending(): boolean {
      return activeFlush !== null;
    },
  };
}
