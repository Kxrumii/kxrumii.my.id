import { transitionEvents } from '@kxrumii/transition-bridge';

export type MotionGroup =
  | 'orbit-enter'
  | 'orbit-exit'
  | 'list-stagger'
  | 'list-reflow'
  | 'view-switch'
  | 'add'
  | 'status'
  | 'delete-exit'
  | 'reader'
  | 'task-dialog'
  | 'accordion';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

export interface FlipDelta {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  moved: boolean;
  scaled: boolean;
}

export interface FlipDeltaOptions {
  parentScaleX?: number;
  parentScaleY?: number;
  includeScale?: boolean;
  minScale?: number;
  maxScale?: number;
  moveThresholdPx?: number;
  scaleThreshold?: number;
}

export interface ViewportClipInset {
  clipPath: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
  contentDx: number;
  contentDy: number;
}

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

/** Kebijakan murni: boleh nggaknya animasi app jalan. */
export function shouldAnimate(env: MotionEnv): boolean {
  return !env.reducedMotion && !env.transitionActive && env.supportsAnimate;
}

export function canAnimate(overrides?: Partial<MotionEnv>): boolean {
  const env = overrides ? { ...readMotionEnv(), ...overrides } : readMotionEnv();
  return shouldAnimate(env);
}

/**
 * Hitung jeda stagger (ms) untuk `count` elemen.
 * Elemen setelah indeks `maxItems - 1` dapat `null` (langsung tampil tanpa animasi).
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
 * Target fokus aman waktu tombol prev/next Reader Dialog jadi disabled
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

function clampScale(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function intersectsViewport(rect: RectLike, bounds: RectLike): boolean {
  if (rect.width <= 0 || rect.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }
  const rectRight = rect.right ?? rect.left + rect.width;
  const rectBottom = rect.bottom ?? rect.top + rect.height;
  const boundsRight = bounds.right ?? bounds.left + bounds.width;
  const boundsBottom = bounds.bottom ?? bounds.top + bounds.height;
  return (
    rectRight > bounds.left &&
    rect.left < boundsRight &&
    rectBottom > bounds.top &&
    rect.top < boundsBottom
  );
}

/**
 * Delta FLIP (First → Last) berbasis pusat elemen, dengan kompensasi skala parent
 * supaya animasi `.box-print` di dalam `.task-box` tetap akurat.
 */
export function computeFlipDelta(
  first: RectLike,
  last: RectLike,
  options: FlipDeltaOptions = {},
): FlipDelta {
  if (first.width <= 0 || first.height <= 0 || last.width <= 0 || last.height <= 0) {
    return { tx: 0, ty: 0, sx: 1, sy: 1, moved: false, scaled: false };
  }

  const pScaleX = options.parentScaleX !== undefined && options.parentScaleX > 0 ? options.parentScaleX : 1;
  const pScaleY = options.parentScaleY !== undefined && options.parentScaleY > 0 ? options.parentScaleY : 1;

  const vx = first.left + first.width / 2 - (last.left + last.width / 2);
  const vy = first.top + first.height / 2 - (last.top + last.height / 2);

  let tx = vx / pScaleX;
  let ty = vy / pScaleY;

  const includeScale = options.includeScale ?? true;
  const minScale = options.minScale ?? 0.45;
  const maxScale = options.maxScale ?? 1.85;
  const sx = includeScale ? clampScale(first.width / last.width, minScale, maxScale) : 1;
  const sy = includeScale ? clampScale(first.height / last.height, minScale, maxScale) : 1;

  const moveThresholdPx = options.moveThresholdPx ?? 1;
  const scaleThreshold = options.scaleThreshold ?? 0.015;
  const moved = Math.abs(tx) > moveThresholdPx || Math.abs(ty) > moveThresholdPx;
  const scaled = Math.abs(sx - 1) > scaleThreshold || Math.abs(sy - 1) > scaleThreshold;

  if (!moved) {
    tx = 0;
    ty = 0;
  }

  return { tx, ty, sx, sy, moved, scaled };
}

function isFinitePositiveRect(rect: RectLike | null | undefined): rect is RectLike {
  if (!rect) return false;
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Hitung `clip-path: inset(...)` relatif ke `dialogRect` dari `sourceRect` yang beririsan
 * dengan area pakai dialog & viewport. Hasilnya `null` kalau sumber di luar jangkauan
 * atau nggak layak buat transisi bersama.
 */
export function computeViewportClipInset(
  sourceRect: RectLike,
  dialogRect: RectLike,
  viewport?: RectLike,
): ViewportClipInset | null {
  if (!isFinitePositiveRect(sourceRect) || !isFinitePositiveRect(dialogRect)) {
    return null;
  }
  if (viewport !== undefined && !isFinitePositiveRect(viewport)) {
    return null;
  }

  const dialogRight = dialogRect.right ?? dialogRect.left + dialogRect.width;
  const dialogBottom = dialogRect.bottom ?? dialogRect.top + dialogRect.height;

  let usableLeft = dialogRect.left;
  let usableTop = dialogRect.top;
  let usableRight = dialogRight;
  let usableBottom = dialogBottom;

  if (viewport) {
    const vpRight = viewport.right ?? viewport.left + viewport.width;
    const vpBottom = viewport.bottom ?? viewport.top + viewport.height;
    usableLeft = Math.max(usableLeft, viewport.left);
    usableTop = Math.max(usableTop, viewport.top);
    usableRight = Math.min(usableRight, vpRight);
    usableBottom = Math.min(usableBottom, vpBottom);
  }

  if (usableRight <= usableLeft || usableBottom <= usableTop) {
    return null;
  }

  const sourceRight = sourceRect.right ?? sourceRect.left + sourceRect.width;
  const sourceBottom = sourceRect.bottom ?? sourceRect.top + sourceRect.height;

  const clippedLeft = Math.max(sourceRect.left, usableLeft);
  const clippedTop = Math.max(sourceRect.top, usableTop);
  const clippedRight = Math.min(sourceRight, usableRight);
  const clippedBottom = Math.min(sourceBottom, usableBottom);

  const visibleW = clippedRight - clippedLeft;
  const visibleH = clippedBottom - clippedTop;
  if (visibleW < 8 || visibleH < 8) {
    return null;
  }

  const top = clampScale(clippedTop - dialogRect.top, 0, dialogRect.height);
  const left = clampScale(clippedLeft - dialogRect.left, 0, dialogRect.width);
  const bottom = clampScale(dialogBottom - clippedBottom, 0, dialogRect.height);
  const right = clampScale(dialogRight - clippedRight, 0, dialogRect.width);

  if (top + bottom >= dialogRect.height || left + right >= dialogRect.width) {
    return null;
  }

  const srcCx = (clippedLeft + clippedRight) / 2;
  const srcCy = (clippedTop + clippedBottom) / 2;
  const dlgCx = dialogRect.left + dialogRect.width / 2;
  const dlgCy = dialogRect.top + dialogRect.height / 2;

  const contentDx = clampScale((srcCx - dlgCx) * 0.08, -28, 28);
  const contentDy = clampScale((srcCy - dlgCy) * 0.08, -24, 24);

  return {
    clipPath: `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px)`,
    top,
    right,
    bottom,
    left,
    contentDx,
    contentDy,
  };
}

function safeCancel(animation: AnimationLike): void {
  try {
    animation.cancel();
  } catch {
    /* animasinya mungkin sudah selesai/dibatalkan */
  }
}

/** Registry animasi per grup; dibersihkan otomatis dan nggak bikin unhandled rejection. */
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

/** Daftarkan callback flush yang dipanggil saat transisi rute keluar dimulai. */
export function registerTransitionFlush(callback: () => void): () => void {
  transitionFlushCallbacks.add(callback);
  return () => {
    transitionFlushCallbacks.delete(callback);
  };
}

/**
 * Ikat pembatalan semua motion CP2 ke event `kxrumii:transition` dari Shared
 * Transition Bridge dengan fase `exit-start`.
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
        /* flush yang gagal nggak boleh menghentikan pembersihan rute */
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
 * Koordinator hapus persist-first: data selalu disimpan sinkron dulu; animasi keluar
 * opsional dan dijamin selesai lewat callback animasi, timeout fallback 300ms, atau flush.
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
