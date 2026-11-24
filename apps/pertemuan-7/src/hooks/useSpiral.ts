import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/*
 * Spiral physics for the Works stage (CSS 3D, no WebGL).
 *
 * Position `p` is measured in cards: card i sits at offset d = i - p (wrapped
 * when looping). Each frame converts d into a helix transform written straight
 * to the DOM, so React only re-renders when the active card changes.
 *
 * - wheel (deltaMode-normalised), pointer drag / horizontal swipe, ←/→, prev/next
 * - friction 0.92 per 60 fps frame, then a spring snap to the nearest card
 * - slow auto-drift, paused on hover, keyboard focus, drag, hidden tab, reduced motion and
 *   while `paused` (the work sheet is open); wheel/pointer input is ignored then too
 * - 0 items: nothing renders and no frame loop runs; 1–2 items never loop, so
 *   they always stay in front of the camera
 * - reduced motion: no requestAnimationFrame loop at all; steps jump instantly
 */

/*
 * Angular step between cards. With radius = RADIUS_PER_WIDTH × card width, neighbours sit RADIUS·sin(step) apart in
 * x while only (1 + cos(step)) / 2 card widths are needed to clear each other: 0.935 vs 0.85 widths at 46°/1.3 (before perspective, which only shrinks the far cards), so the
 * front three cards never overlap. Cards two steps away (92°) are fully faded: no hidden slivers behind the others.
 */
const STEP_DEG = 46;
const RADIUS_PER_WIDTH = 1.3;
const FADE_START_DEG = 62;
const FADE_SPAN_DEG = 22;
const FRICTION = 0.92;
const SNAP_STIFFNESS = 140;
const SNAP_DAMPING = 18;
const DRIFT_PER_SEC = 0.08;
const WHEEL_GAIN = 0.045;
const LINE_PX = 18;
const MAX_VELOCITY = 8;
const DRAG_THRESHOLD_PX = 6;
/** Fling after a drag is damped and capped so one swipe moves about one or two cards. */
const DRAG_FLING = 0.5;
const MAX_DRAG_VELOCITY = 4;

export interface SpiralOptions {
  count: number;
  /** Index the spiral should show when it (re)starts, e.g. the active work. */
  initialIndex: number;
  /** Changes whenever the item list changes (filter), so the spiral re-seats itself. */
  resetKey: string;
  reducedMotion: boolean;
  /** Suspends drift and all input without losing the position. */
  paused: boolean;
  onActiveChange: (index: number) => void;
}

export interface SpiralApi {
  viewportRef: (node: HTMLDivElement | null) => void;
  cardRef: (index: number) => (node: HTMLElement | null) => void;
  step: (direction: 1 | -1) => number;
  goTo: (index: number) => void;
  /** True when the last pointer interaction was a drag (its click must not navigate). */
  consumeDrag: () => boolean;
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export function useSpiral({ count, initialIndex, resetKey, reducedMotion, paused, onActiveChange }: SpiralOptions): SpiralApi {
  const viewport = useRef<HTMLDivElement | null>(null);
  const cards = useRef<Array<HTMLElement | null>>([]);
  const state = useRef({
    p: 0,
    v: 0,
    snapBias: 0,
    dragging: false,
    dragStartX: 0,
    dragStartP: 0,
    lastX: 0,
    lastT: 0,
    dragged: false,
    hover: false,
    focus: false,
    raf: 0,
    lastFrame: 0,
    active: -1,
    geometry: { radius: 300, rise: 70, pxPerItem: 260 },
  });
  const optionsRef = useRef({ count, reducedMotion, paused, onActiveChange });
  optionsRef.current = { count, reducedMotion, paused, onActiveChange };

  const loops = () => optionsRef.current.count >= 3;

  const clampPosition = (p: number) => {
    const n = optionsRef.current.count;
    if (n <= 0) return 0;
    if (loops()) return finite(p);
    return Math.min(Math.max(finite(p), 0), n - 1);
  };

  const activeIndexFor = (p: number) => {
    const n = optionsRef.current.count;
    if (n <= 0) return -1;
    const rounded = Math.round(finite(p));
    return ((rounded % n) + n) % n;
  };

  const render = useCallback(() => {
    const s = state.current;
    const n = optionsRef.current.count;
    if (n <= 0) return;
    const { radius, rise } = s.geometry;
    const half = n / 2;
    for (let i = 0; i < n; i += 1) {
      const el = cards.current[i];
      if (!el) continue;
      let d = i - s.p;
      if (loops()) d = ((((d + half) % n) + n) % n) - half;
      d = finite(d);
      const angle = d * STEP_DEG;
      const y = d * rise;
      // Fade cards turning away from the camera, and at the loop seam so the wrap jump is never visible.
      const away = 1 - Math.min(Math.max((Math.abs(angle) - FADE_START_DEG) / FADE_SPAN_DEG, 0), 1);
      const seam = loops() ? Math.min(Math.max((half - Math.abs(d)) / 0.5, 0), 1) : 1;
      const opacity = finite(Math.min(away, seam), 0);
      el.style.transform = `translate3d(-50%, -50%, 0) translate3d(0, ${y.toFixed(2)}px, ${(-radius).toFixed(2)}px) rotateY(${angle.toFixed(3)}deg) translateZ(${radius.toFixed(2)}px)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
      el.style.pointerEvents = opacity < 0.5 ? 'none' : 'auto';
    }
    const active = activeIndexFor(s.p);
    if (active !== s.active) {
      s.active = active;
      optionsRef.current.onActiveChange(active);
    }
  }, []);

  const driftAllowed = () => {
    const s = state.current;
    return (
      loops() &&
      !optionsRef.current.reducedMotion &&
      !optionsRef.current.paused &&
      !s.hover &&
      !s.focus &&
      !s.dragging &&
      document.visibilityState === 'visible'
    );
  };

  const stop = () => {
    const s = state.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  };

  const frame = useCallback((now: number) => {
    const s = state.current;
    s.raf = 0;
    if (optionsRef.current.count <= 0 || optionsRef.current.reducedMotion) return;
    const dt = Math.min(Math.max((now - (s.lastFrame || now)) / 1000, 0), 0.05);
    s.lastFrame = now;
    const drifting = driftAllowed();

    if (!s.dragging) {
      s.v *= Math.pow(FRICTION, dt * 60);
      if (drifting) {
        s.p += (s.v + DRIFT_PER_SEC) * dt;
      } else if (Math.abs(s.v) < 0.35) {
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
    const settled = !s.dragging && !drifting && s.v === 0 && s.p === Math.round(s.p);
    if (!settled) s.raf = requestAnimationFrame(frame);
  }, [render]);

  const kick = useCallback(() => {
    const s = state.current;
    if (optionsRef.current.reducedMotion || optionsRef.current.count <= 0) {
      render();
      return;
    }
    if (!s.raf) {
      s.lastFrame = 0;
      s.raf = requestAnimationFrame(frame);
    }
  }, [frame, render]);

  const goTo = useCallback(
    (index: number) => {
      const s = state.current;
      const n = optionsRef.current.count;
      if (n <= 0 || optionsRef.current.paused) return;
      const safe = Math.min(Math.max(Math.round(finite(index)), 0), n - 1);
      if (optionsRef.current.reducedMotion) {
        s.p = safe;
        s.v = 0;
        render();
        return;
      }
      // Travel the shortest way round when looping.
      let target = safe;
      if (loops()) {
        const current = Math.round(s.p);
        const base = current - activeIndexFor(current);
        target = base + safe;
        if (target - s.p > n / 2) target -= n;
        if (s.p - target > n / 2) target += n;
      }
      s.v = (target - s.p) * 6;
      s.snapBias = 0;
      kick();
    },
    [kick, render],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      const n = optionsRef.current.count;
      if (n <= 0 || optionsRef.current.paused) return -1;
      const current = activeIndexFor(state.current.p);
      const next = loops() ? (current + direction + n) % n : Math.min(Math.max(current + direction, 0), n - 1);
      goTo(next);
      return next;
    },
    [goTo],
  );

  // Re-seat when the list changes (filter) or motion preference flips. Layout effect: no stacked first frame.
  useLayoutEffect(() => {
    const s = state.current;
    stop();
    s.v = 0;
    s.snapBias = 0;
    s.active = -1;
    s.p = count > 0 ? Math.min(Math.max(Math.round(finite(initialIndex)), 0), count - 1) : 0;
    if (count <= 0) return;
    render();
    kick();
    return stop;
    // initialIndex is intentionally read only when the list itself changes.
  }, [resetKey, count, reducedMotion, render, kick]);

  // Geometry follows the card size (and stays inside narrow viewports).
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || count <= 0) return;
    const measure = () => {
      const card = cards.current.find(Boolean);
      const width = finite(card?.offsetWidth ?? 0, 0) || 280;
      const height = finite(card?.offsetHeight ?? 0, 0) || 180;
      // The stage width is handled in CSS (card width <= 38cqw), so the radius only follows the card.
      const radius = width * RADIUS_PER_WIDTH;
      state.current.geometry = { radius, rise: height * 0.36, pxPerItem: Math.max(width * 0.8, 120) };
      render();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, resetKey, render]);

  // Input: wheel (non-passive so the page does not scroll), pointer drag, hover/focus pause, tab visibility.
  useEffect(() => {
    const node = viewport.current;
    if (!node || count <= 0) return;
    const s = state.current;

    const onWheel = (event: WheelEvent) => {
      if (optionsRef.current.paused) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const delta = Math.max(Math.min(finite(raw) * unit, 120), -120);
      if (delta === 0) return;
      event.preventDefault();
      if (optionsRef.current.reducedMotion) {
        step(delta > 0 ? 1 : -1);
        return;
      }
      s.v = Math.max(Math.min(s.v + delta * WHEEL_GAIN, MAX_VELOCITY), -MAX_VELOCITY);
      s.snapBias = Math.sign(delta);
      kick();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (optionsRef.current.paused) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      s.dragging = true;
      s.dragged = false;
      s.dragStartX = event.clientX;
      s.dragStartP = s.p;
      s.lastX = event.clientX;
      s.lastT = event.timeStamp;
      s.v = 0;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!s.dragging) return;
      const dx = event.clientX - s.dragStartX;
      if (!s.dragged && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        s.dragged = true;
        node.setPointerCapture?.(event.pointerId);
      }
      if (!s.dragged) return;
      const dt = Math.max((event.timeStamp - s.lastT) / 1000, 0.001);
      const vx = (event.clientX - s.lastX) / dt;
      s.lastX = event.clientX;
      s.lastT = event.timeStamp;
      s.v = Math.max(Math.min((-vx / s.geometry.pxPerItem) * DRAG_FLING, MAX_DRAG_VELOCITY), -MAX_DRAG_VELOCITY);
      s.p = clampPosition(s.dragStartP - dx / s.geometry.pxPerItem);
      if (optionsRef.current.reducedMotion) render();
      else kick();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!s.dragging) return;
      s.dragging = false;
      if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
      if (s.dragged) {
        s.snapBias = Math.sign(s.v);
        if (optionsRef.current.reducedMotion) {
          s.p = clampPosition(Math.round(s.p));
          s.v = 0;
          render();
        } else kick();
      }
    };
    const onEnter = () => {
      s.hover = true;
      kick();
    };
    const onLeave = () => {
      s.hover = false;
      kick();
    };
    // Only keyboard focus holds the spiral still. Focus handed back by script after a mouse-closed sheet
    // is not :focus-visible, so the drift can resume once the pointer leaves.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null;
      s.focus = target?.matches?.(':focus-visible') === true;
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
    node.addEventListener('pointerenter', onEnter);
    node.addEventListener('pointerleave', onLeave);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('pointerleave', onLeave);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count, resetKey, kick, render, step]);

  // Drift stops while paused (the loop settles and ends) and resumes when the sheet closes.
  useEffect(() => {
    kick();
  }, [paused, kick]);

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    viewport.current = node;
  }, []);

  const cardRef = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      cards.current[index] = node;
    },
    [],
  );

  const consumeDrag = useCallback(() => {
    const dragged = state.current.dragged;
    state.current.dragged = false;
    return dragged;
  }, []);

  return { viewportRef, cardRef, step, goTo, consumeDrag };
}
