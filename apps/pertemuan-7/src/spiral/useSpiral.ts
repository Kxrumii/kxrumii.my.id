import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { activeWorkIndex, cardPose, loops, nearestPositionFor, slotCount, type SpiralGeometry } from './geometry.ts';

/*
 * Spiral physics (adapted from the earlier Task 7 spiral, commit f2dcdec). Position `p` is measured in slots;
 * every frame writes each card's transform straight to the DOM, so React re-renders only when the active work
 * changes.
 *
 * - wheel/trackpad (deltaMode-normalised) and pointer drag (vertical or horizontal) push the coil with inertia
 * - friction, then a spring snap onto the nearest slot
 * - a slow idle drift; it stops while a card is hovered or keyboard-focused, while dragging, when the tab is
 *   hidden, while `paused` (loader/menu) and under reduced motion
 * - reduced motion: no animation frame loop at all, steps jump instantly
 */

const FRICTION = 0.93;
const SNAP_STIFFNESS = 120;
const SNAP_DAMPING = 17;
const DRIFT_PER_SEC = 0.11;
const WHEEL_GAIN = 0.028;
const LINE_PX = 18;
const MAX_VELOCITY = 9;
const DRAG_THRESHOLD_PX = 6;
const DRAG_FLING = 0.55;
const MAX_DRAG_VELOCITY = 5;
const RADIUS_PER_WIDTH = 1.25;
const RISE_PER_HEIGHT = 0.58;

export interface SpiralOptions {
  workCount: number;
  initialIndex: number;
  reducedMotion: boolean;
  paused: boolean;
  onActiveChange: (workIndex: number) => void;
}

export interface SpiralApi {
  viewportRef: (node: HTMLDivElement | null) => void;
  cardRef: (slot: number) => (node: HTMLElement | null) => void;
  slots: number;
  step: (direction: 1 | -1) => void;
  goTo: (workIndex: number) => void;
  setHover: (hovering: boolean) => void;
  /** True when the last pointer interaction was a drag (its click must not navigate). */
  consumeDrag: () => boolean;
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export function useSpiral({ workCount, initialIndex, reducedMotion, paused, onActiveChange }: SpiralOptions): SpiralApi {
  const slots = slotCount(workCount);
  const viewport = useRef<HTMLDivElement | null>(null);
  const cards = useRef<Array<HTMLElement | null>>([]);
  const state = useRef({
    p: 0,
    v: 0,
    snapBias: 0,
    /** Destination of discrete steps (keys, goTo); repeated presses add up. null = free motion. */
    stepTarget: null as number | null,
    dragging: false,
    dragged: false,
    axis: 'y' as 'x' | 'y',
    startX: 0,
    startY: 0,
    startP: 0,
    last: 0,
    lastT: 0,
    hover: false,
    focus: false,
    raf: 0,
    lastFrame: 0,
    active: -1,
    geometry: { radius: 340, rise: 120 } as SpiralGeometry,
    pxPerSlot: 160,
  });
  const options = useRef({ workCount, slots, reducedMotion, paused, onActiveChange });
  options.current = { workCount, slots, reducedMotion, paused, onActiveChange };

  const clampPosition = (p: number) => {
    const { workCount: n } = options.current;
    if (n <= 0) return 0;
    if (loops(n)) return finite(p);
    return Math.min(Math.max(finite(p), 0), n - 1);
  };

  const render = useCallback(() => {
    const s = state.current;
    const { workCount: n, slots: total } = options.current;
    if (n <= 0) return;
    const looping = loops(n);
    for (let i = 0; i < total; i += 1) {
      const el = cards.current[i];
      if (!el) continue;
      const pose = cardPose(i, s.p, total, looping, s.geometry);
      el.style.transform = pose.transform;
      // Opacity goes to the faces via a variable: opacity < 1 on the preserve-3d card would flatten it and
      // show the mirrored front instead of the back plate.
      el.style.setProperty('--o', String(pose.opacity));
      el.style.visibility = pose.opacity < 0.02 ? 'hidden' : 'visible';
      el.style.pointerEvents = pose.interactive ? 'auto' : 'none';
      el.dataset.front = pose.facing > 0.9 ? 'true' : 'false';
    }
    const active = activeWorkIndex(s.p, n);
    if (active !== s.active) {
      s.active = active;
      options.current.onActiveChange(active);
    }
  }, []);

  const driftAllowed = () => {
    const s = state.current;
    const o = options.current;
    return loops(o.workCount) && !o.reducedMotion && !o.paused && !s.hover && !s.focus && !s.dragging && document.visibilityState === 'visible';
  };

  const stop = () => {
    const s = state.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  };

  const frame = useCallback(
    (now: number) => {
      const s = state.current;
      s.raf = 0;
      if (options.current.workCount <= 0 || options.current.reducedMotion) return;
      const dt = Math.min(Math.max((now - (s.lastFrame || now)) / 1000, 0), 0.05);
      s.lastFrame = now;
      const drifting = driftAllowed();
      if (!s.dragging && s.stepTarget !== null) {
        // Discrete step: spring straight to the requested slot.
        const a = SNAP_STIFFNESS * (s.stepTarget - s.p) - SNAP_DAMPING * s.v;
        s.v += a * dt;
        s.p += s.v * dt;
        if (Math.abs(s.stepTarget - s.p) < 0.0005 && Math.abs(s.v) < 0.002) {
          s.p = s.stepTarget;
          s.v = 0;
          s.stepTarget = null;
        }
      } else if (!s.dragging) {
        s.v *= Math.pow(FRICTION, dt * 60);
        if (drifting && Math.abs(s.v) < 0.5) {
          s.p += (s.v + DRIFT_PER_SEC) * dt;
        } else if (Math.abs(s.v) < 0.4) {
          const target = clampPosition(Math.round(s.p + 0.35 * s.snapBias));
          const a = SNAP_STIFFNESS * (target - s.p) - SNAP_DAMPING * s.v;
          s.v += a * dt;
          s.p += s.v * dt;
          if (Math.abs(target - s.p) < 0.0005 && Math.abs(s.v) < 0.002) {
            s.p = target;
            s.v = 0;
            s.snapBias = 0;
          }
        } else {
          s.p += s.v * dt;
        }
        const clamped = clampPosition(s.p);
        if (clamped !== s.p) {
          s.p = clamped;
          s.v = 0;
        }
      }
      render();
      const settled = !s.dragging && s.stepTarget === null && !driftAllowed() && s.v === 0 && s.p === Math.round(s.p);
      if (!settled) s.raf = requestAnimationFrame(frame);
    },
    [render],
  );

  const kick = useCallback(() => {
    const s = state.current;
    if (options.current.reducedMotion || options.current.workCount <= 0) {
      render();
      return;
    }
    if (!s.raf) {
      s.lastFrame = 0;
      s.raf = requestAnimationFrame(frame);
    }
  }, [frame, render]);

  const goTo = useCallback(
    (workIndex: number) => {
      const s = state.current;
      const n = options.current.workCount;
      if (n <= 0 || options.current.paused) return;
      const target = nearestPositionFor(workIndex, s.p, n);
      if (options.current.reducedMotion) {
        s.p = target;
        s.v = 0;
        s.stepTarget = null;
        render();
        return;
      }
      s.stepTarget = target;
      s.snapBias = 0;
      kick();
    },
    [kick, render],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      const s = state.current;
      const n = options.current.workCount;
      if (n <= 0 || options.current.paused) return;
      const base = s.stepTarget ?? Math.round(s.p);
      const target = clampPosition(base + direction);
      if (options.current.reducedMotion) {
        s.p = target;
        s.stepTarget = null;
        render();
        return;
      }
      s.stepTarget = target;
      kick();
    },
    [kick, render],
  );

  const setHover = useCallback(
    (hovering: boolean) => {
      state.current.hover = hovering;
      kick();
    },
    [kick],
  );

  // Re-seat when the list size or the motion preference changes.
  useLayoutEffect(() => {
    const s = state.current;
    stop();
    s.v = 0;
    s.snapBias = 0;
    s.stepTarget = null;
    s.active = -1;
    s.p = workCount > 0 ? Math.min(Math.max(Math.round(finite(initialIndex)), 0), workCount - 1) : 0;
    if (workCount <= 0) return;
    render();
    kick();
    return stop;
    // initialIndex is read only when the list itself changes.
  }, [workCount, reducedMotion, render, kick]);

  // Geometry follows the card size, which CSS derives from the viewport.
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || workCount <= 0) return;
    const measure = () => {
      const card = cards.current.find(Boolean);
      const width = finite(card?.offsetWidth ?? 0) || 300;
      const height = finite(card?.offsetHeight ?? 0) || 200;
      state.current.geometry = { radius: width * RADIUS_PER_WIDTH, rise: height * RISE_PER_HEIGHT };
      state.current.pxPerSlot = Math.max(height * 0.9, 90);
      node.style.setProperty('--spiral-radius', `${(width * RADIUS_PER_WIDTH).toFixed(1)}px`);
      render();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [workCount, render]);

  // Input: wheel (non-passive so the page never scrolls), pointer drag, keyboard focus, tab visibility.
  useEffect(() => {
    const node = viewport.current;
    if (!node || workCount <= 0) return;
    const s = state.current;

    const onWheel = (event: WheelEvent) => {
      if (options.current.paused) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const delta = Math.max(Math.min(finite(raw) * unit, 140), -140);
      if (delta === 0) return;
      event.preventDefault();
      if (options.current.reducedMotion) {
        step(delta > 0 ? 1 : -1);
        return;
      }
      s.stepTarget = null;
      s.v = Math.max(Math.min(s.v + delta * WHEEL_GAIN, MAX_VELOCITY), -MAX_VELOCITY);
      s.snapBias = Math.sign(delta);
      kick();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (options.current.paused) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      s.dragging = true;
      s.dragged = false;
      s.stepTarget = null;
      s.startX = event.clientX;
      s.startY = event.clientY;
      s.startP = s.p;
      s.lastT = event.timeStamp;
      s.v = 0;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!s.dragging) return;
      const dx = event.clientX - s.startX;
      const dy = event.clientY - s.startY;
      if (!s.dragged) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= DRAG_THRESHOLD_PX) return;
        s.dragged = true;
        s.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
        s.last = s.axis === 'y' ? event.clientY : event.clientX;
        node.setPointerCapture?.(event.pointerId);
      }
      const coord = s.axis === 'y' ? event.clientY : event.clientX;
      const moved = s.axis === 'y' ? dy : dx;
      const dt = Math.max((event.timeStamp - s.lastT) / 1000, 0.001);
      const speed = (coord - s.last) / dt;
      s.last = coord;
      s.lastT = event.timeStamp;
      s.v = Math.max(Math.min((-speed / s.pxPerSlot) * DRAG_FLING, MAX_DRAG_VELOCITY), -MAX_DRAG_VELOCITY);
      s.p = clampPosition(s.startP - moved / s.pxPerSlot);
      if (options.current.reducedMotion) render();
      else kick();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!s.dragging) return;
      s.dragging = false;
      if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
      if (!s.dragged) return;
      s.snapBias = Math.sign(s.v);
      if (options.current.reducedMotion) {
        s.p = clampPosition(Math.round(s.p));
        s.v = 0;
        render();
      } else kick();
    };
    // Only keyboard focus holds the spiral still.
    const onFocusIn = (event: FocusEvent) => {
      s.focus = (event.target as Element | null)?.matches?.(':focus-visible') === true;
      kick();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null)) {
        s.focus = false;
        kick();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else kick();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [workCount, kick, render, step]);

  // Drift resumes when the pause (loader, menu) ends.
  useEffect(() => {
    kick();
  }, [paused, kick]);

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    viewport.current = node;
  }, []);

  const cardRef = useCallback(
    (slot: number) => (node: HTMLElement | null) => {
      cards.current[slot] = node;
    },
    [],
  );

  const consumeDrag = useCallback(() => {
    const dragged = state.current.dragged;
    state.current.dragged = false;
    return dragged;
  }, []);

  return { viewportRef, cardRef, slots, step, goTo, setHover, consumeDrag };
}
