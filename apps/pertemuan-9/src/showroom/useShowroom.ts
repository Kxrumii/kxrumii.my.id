import { transitionEvents } from '@kxrumii/transition-bridge';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ensureMusicClock } from '../audio/musicSource';
import {
  getSnapshot as getSoundSnapshot,
  play as playSound,
  scrubVoice,
  setMusicMuted,
  setMusicScrubDucked,
  subscribe as subscribeSound,
} from '../audio/soundEngine';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useShell } from '../shell/shellContext';
import type { Work } from '../types';
import type { ProfileId } from './camera.ts';
import { anchorTransform, cameraTransform, depthState } from './cameraTransform.ts';
import { PROFILES, profileFor } from './choreography.ts';
import {
  DEFAULT_POLICY,
  initialControllerState,
  reduce,
  type ControllerEvent,
  type ControllerState,
  type Effect,
  type Owner,
  type Phase,
} from './controller.ts';
import { fragmentClearance } from './clearance.ts';
import { FRAGMENT_SEED, generateFragments, type FilmFragmentSpec } from './fragments.ts';
import { activeClock, setMusicClock, sharedTransport, takeFirstSeat } from './runtime.ts';
import { alignToPeriod, masterCycleS } from './tempo.ts';
import {
  buildTimeline,
  holdStartOf,
  navPlan,
  fixedSchedule,
  sceneAt,
  validateTimeline,
  type NavPlan,
  type Timeline,
} from './timeline.ts';
import { wrapTime } from './time.ts';
import { normalizeWheelDelta, wheelToTimelineSeconds } from './wheel.ts';

/*
 * Showroom runtime: wires the pure model (timeline, transport, controller) to the DOM.
 *
 *  - Controller events go in through dispatch(); the returned effects are executed here (transport, SFX, timers...).
 *  - One requestAnimationFrame loop samples transport.visualPosition() and writes the camera transform and the
 *    depth opacity of each anchor imperatively. React only re-renders for semantic changes (focus, phase, owner).
 *  - The loop runs only while the transport plays; it is cancelled on pause, reduced motion, hidden tab and unmount.
 *  - This module writes `transform` on the camera element and `opacity`/`visibility` on anchors and fragments; the
 *    Shape Morph runner owns clip-path and the sheet FLIP owns the sheet's transforms.
 */

const EDGE_PX = 24;
const DRAG_THRESHOLD_PX = 6;
const REDUCED_WHEEL_GAP_MS = 450;
const ARRIVAL_EPS_S = 1e-6;

export interface ShowroomUi {
  focusSlug: string | null;
  phase: Phase;
  owner: Owner;
  userPaused: boolean;
  reducedMotion: boolean;
}

interface Live {
  timeline: Timeline | null;
  fragments: readonly FilmFragmentSpec[];
  scale: number;
  perspectivePx: number;
  anchors: ReadonlyArray<{ slug: string; x: number; y: number; z: number }>;
}

interface Host {
  live(): Live;
  camera(): HTMLElement | null;
  anchor(slug: string): HTMLElement | undefined;
  fragment(id: string): HTMLElement | undefined;
  reducedMotion(): boolean;
  setUi(update: (prev: ShowroomUi) => ShowroomUi): void;
  onFocus(slug: string): void;
}

function writeOpacity(el: HTMLElement, cache: Map<HTMLElement, number>, opacity: number): void {
  const rounded = Math.round(opacity * 100) / 100;
  if (cache.get(el) === rounded) return;
  cache.set(el, rounded);
  el.style.opacity = String(rounded);
  el.style.visibility = rounded < 0.02 ? 'hidden' : 'visible';
}

/** The master transport for a camera timeline: its cycle is the LCM of the camera cycle and the music loop. */
const transportFor = (timeline: Timeline) => sharedTransport(masterCycleS(timeline.cycleS));

/** Seek target for camera-cycle time `targetS`, in the camera period closest to the current master position. */
const alignedSeek = (timeline: Timeline, position: number, targetS: number) =>
  alignToPeriod(position, targetS, timeline.cycleS, masterCycleS(timeline.cycleS));

function createRuntime(host: Host) {
  let state: ControllerState = initialControllerState(false);
  let nav: NavPlan | null = null;
  let lastPhase: Phase = 'hold';
  let lastFocus = -1;
  let staticFocus = 0;
  let raf = 0;
  let rendering = false;
  let mounted = false;
  const timers = new Map<string, number>();
  const opacityCache = new Map<HTMLElement, number>();

  const transport = () => {
    const { timeline } = host.live();
    return timeline ? transportFor(timeline) : null;
  };

  function focusIndexNow(): number {
    const { timeline } = host.live();
    const tr = transport();
    if (!timeline || !tr) return 0;
    return sceneAt(timeline, tr.position(), nav?.variant ?? 'forward').focusIndex;
  }

  function ensureLoop(): void {
    if (raf || host.reducedMotion() || !mounted) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
      if (mounted && transport()?.isPlaying() && !host.reducedMotion()) ensureLoop();
    });
  }

  function stopLoop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function render(): void {
    const live = host.live();
    const camera = host.camera();
    const tr = transport();
    if (!live.timeline || !camera || !tr || rendering) return;
    const { timeline, scale, perspectivePx } = live;
    rendering = true;
    let arrived = false;
    let phase: Phase = 'hold';
    let focusIndex = 0;
    try {
      const reduced = host.reducedMotion();
      const scene = sceneAt(timeline, tr.visualPosition(), nav?.variant ?? 'forward');
      const pose = reduced ? timeline.cues[staticFocus].stop.pose : scene.camera;
      camera.style.transform = cameraTransform({ ...pose, x: pose.x * scale, y: pose.y * scale, z: pose.z * scale }, perspectivePx * scale);

      for (const anchor of live.anchors) {
        const el = host.anchor(anchor.slug);
        if (el) writeOpacity(el, opacityCache, depthState(pose, anchor, perspectivePx).opacity);
      }
      for (const fragment of live.fragments) {
        const el = host.fragment(fragment.id);
        if (el) writeOpacity(el, opacityCache, depthState(pose, fragment, perspectivePx).opacity);
      }

      focusIndex = reduced ? staticFocus : scene.focusIndex;
      phase = reduced ? 'hold' : scene.phase;
      if (nav) {
        const elapsed = wrapTime(tr.position() - nav.seekToS, timeline.cycleS);
        arrived = elapsed >= nav.durationS - ARRIVAL_EPS_S && elapsed < timeline.cycleS - 0.05;
      }
    } finally {
      rendering = false;
    }

    if (arrived) {
      nav = null;
      dispatch({ type: 'ARRIVED' });
    }
    if (phase !== lastPhase) {
      lastPhase = phase;
      host.setUi((prev) => (prev.phase === phase ? prev : { ...prev, phase }));
      dispatch({ type: 'PHASE', phase });
    }
    if (focusIndex !== lastFocus) {
      lastFocus = focusIndex;
      const slug = timeline.cues[focusIndex].cue.projectSlug;
      host.setUi((prev) => (prev.focusSlug === slug ? prev : { ...prev, focusSlug: slug }));
      host.onFocus(slug);
    }
  }

  function clearTimer(name: string): void {
    const id = timers.get(name);
    if (id !== undefined) window.clearTimeout(id);
    timers.delete(name);
  }

  function execute(effect: Effect): void {
    const { timeline } = host.live();
    const tr = transport();
    switch (effect.type) {
      case 'transport':
        if (!tr) return;
        if (effect.action === 'play') {
          tr.play();
          ensureLoop();
        } else {
          tr.pause();
          render();
        }
        return;
      case 'sfx':
        playSound(effect.name); // silent while SFX is off
        return;
      case 'music':
        if (effect.action === 'duck' || effect.action === 'unduck') setMusicScrubDucked(effect.action === 'duck');
        else setMusicMuted(effect.action === 'mute');
        return;
      case 'scrub':
        scrubVoice(effect.action, effect.dir ?? 1);
        return;
      case 'teardown':
        return;
      case 'scrubBy':
        if (!tr) return;
        tr.seek(tr.position() + effect.deltaS);
        render();
        return;
      case 'align':
        tr?.seek(tr.position());
        return;
      case 'navigate': {
        if (!tr || !timeline) return;
        const plan = navPlan(timeline, focusIndexNow(), effect.dir);
        nav = { ...plan, seekToS: alignedSeek(timeline, tr.position(), plan.seekToS) };
        tr.seek(nav.seekToS);
        render();
        return;
      }
      case 'staticStep': {
        if (!tr || !timeline) return;
        const n = timeline.cues.length;
        staticFocus = (staticFocus + effect.dir + n) % n;
        tr.seek(alignedSeek(timeline, tr.position(), holdStartOf(timeline, staticFocus)));
        render();
        return;
      }
      case 'seekToHold':
        if (!tr || !timeline) return;
        tr.seek(alignedSeek(timeline, tr.position(), holdStartOf(timeline, staticFocus)));
        render();
        return;
      case 'jumpToArrival':
        if (!tr || !nav) return;
        tr.seek(nav.seekToS + nav.durationS);
        nav = null;
        render();
        return;
      case 'timer':
        clearTimer(effect.name);
        if (effect.action === 'start') {
          const { name, generation } = effect;
          timers.set(
            name,
            window.setTimeout(() => {
              timers.delete(name);
              dispatch(name === 'hoverLeave' ? { type: 'HOVER_DEBOUNCED', generation } : { type: 'SCRUB_IDLE', generation });
            }, effect.ms),
          );
        }
        return;
    }
  }

  function dispatch(event: ControllerEvent): void {
    if (!mounted && event.type !== 'UNMOUNT') return;
    const out = reduce(state, event, DEFAULT_POLICY);
    state = out.state;
    for (const effect of out.effects) execute(effect);
    const s = state;
    host.setUi((prev) =>
      prev.owner === s.owner && prev.userPaused === s.userPaused && prev.reducedMotion === s.reducedMotion
        ? prev
        : { ...prev, owner: s.owner, userPaused: s.userPaused, reducedMotion: s.reducedMotion },
    );
  }

  return {
    dispatch,
    render,
    state: () => state,
    nav: () => nav,
    mount(initialSlug: string | null): void {
      mounted = true;
      state = initialControllerState(host.reducedMotion());
      nav = null;
      lastPhase = 'hold';
      lastFocus = -1;
      const { timeline } = host.live();
      const tr = transport();
      if (timeline && tr) {
        const wanted = initialSlug ? timeline.cues.findIndex((c) => c.cue.projectSlug === initialSlug) : -1;
        const here = sceneAt(timeline, tr.position());
        const target = wanted >= 0 ? wanted : here.focusIndex;
        // The very first mount starts on a hold (position 0 is the start of a transition); later mounts (back from
        // List or a sheet) keep the shared position unless a different work was asked for.
        if (takeFirstSeat() || here.focusIndex !== target) tr.seek(alignedSeek(timeline, tr.position(), holdStartOf(timeline, target)));
        staticFocus = sceneAt(timeline, tr.position()).focusIndex;
      }
      render();
    },
    unmount(): void {
      if (!mounted) return;
      dispatch({ type: 'UNMOUNT' });
      mounted = false;
      stopLoop();
      for (const name of [...timers.keys()]) clearTimer(name);
      nav = null;
      transport()?.pause();
    },
    setReduced(on: boolean): void {
      if (state.reducedMotion === on) return;
      if (on) staticFocus = focusIndexNow();
      dispatch({ type: 'REDUCED_MOTION', on });
      if (on) stopLoop();
      else if (transport()?.isPlaying()) ensureLoop();
    },
    rerender(): void {
      opacityCache.clear();
      render();
    },
    activeSlug(): string | null {
      const { timeline } = host.live();
      return timeline && lastFocus >= 0 ? timeline.cues[lastFocus].cue.projectSlug : null;
    },
  };
}

export type ShowroomRuntime = ReturnType<typeof createRuntime>;

interface ShowroomOptions {
  works: readonly Work[];
  initialSlug: string | null;
  /** The work sheet is open over the stage. */
  suspendedDetail: boolean;
  onFocusChange: (slug: string) => void;
}

export function useShowroom({ works, initialSlug, suspendedDetail, onFocusChange }: ShowroomOptions) {
  const { locked } = useShell();
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const anchorEls = useRef(new Map<string, HTMLElement>());
  const fragmentEls = useRef(new Map<string, HTMLElement>());

  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [profileId, setProfileId] = useState<ProfileId>(() => profileFor(window.innerWidth, window.innerHeight));
  const profile = PROFILES[profileId];
  const scale = Math.max(0.2, Math.min(size.w / profile.referenceViewport.w, size.h / profile.referenceViewport.h));

  const slugKey = works.map((w) => w.slug).join('|');
  const built = useMemo(() => {
    const slugs = slugKey ? slugKey.split('|') : [];
    const schedule = fixedSchedule(profile);
    const errors = validateTimeline(profile, schedule, slugs);
    if (errors.length > 0) return { timeline: null as Timeline | null, error: errors.join('; ') };
    return { timeline: buildTimeline(profile, schedule) as Timeline | null, error: null as string | null };
  }, [profile, slugKey]);
  const fragments = useMemo(() => generateFragments(profile.fragmentCount, profile.fragmentBounds, FRAGMENT_SEED, fragmentClearance(profile)), [profile]);

  const [ui, setUi] = useState<ShowroomUi>({
    focusSlug: initialSlug,
    phase: 'hold',
    owner: 'AUTOPLAY',
    userPaused: false,
    reducedMotion,
  });

  const liveRef = useRef<Live & { onFocus: (slug: string) => void; reduced: boolean }>({
    timeline: built.timeline,
    fragments,
    scale,
    perspectivePx: profile.perspectivePx,
    anchors: profile.anchors,
    onFocus: onFocusChange,
    reduced: reducedMotion,
  });
  liveRef.current = {
    timeline: built.timeline,
    fragments,
    scale,
    perspectivePx: profile.perspectivePx,
    anchors: profile.anchors,
    onFocus: onFocusChange,
    reduced: reducedMotion,
  };

  const runtimeRef = useRef<ShowroomRuntime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createRuntime({
      live: () => liveRef.current,
      camera: () => cameraRef.current,
      anchor: (slug) => anchorEls.current.get(slug),
      fragment: (id) => fragmentEls.current.get(id),
      reducedMotion: () => liveRef.current.reduced,
      setUi,
      onFocus: (slug) => liveRef.current.onFocus(slug),
    });
  }
  const runtime = runtimeRef.current;

  // Viewport size -> scene scale and choreography profile (with hysteresis).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const w = root.clientWidth || window.innerWidth;
      const h = root.clientHeight || window.innerHeight;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      setProfileId((current) => profileFor(w, h, current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Lifecycle: mount seats the timeline, unmount tears everything down (also under StrictMode's probe unmount).
  useLayoutEffect(() => {
    runtime.mount(initialSlug);
    return () => runtime.unmount();
    // initialSlug is read once, at mount: later focus changes come from the camera itself.
  }, [runtime]);

  // Geometry or timeline changed (resize, profile switch): redraw at the same timeline position.
  useLayoutEffect(() => {
    runtime.rerender();
  }, [runtime, scale, built.timeline, profileId]);

  useEffect(() => {
    if (!locked) runtime.dispatch({ type: 'GATE_DONE' });
  }, [locked, runtime]);

  // Layout effect on purpose: when the sheet closes, the pointer may already rest on the active display and the browser
  // fires pointerenter right after the commit. The controller must be un-suspended by then, or it would ignore the
  // hover while the hover morph (driven by the same event) still ran.
  useLayoutEffect(() => {
    runtime.dispatch(suspendedDetail ? { type: 'SUSPEND', reason: 'detail' } : { type: 'RESUME', reason: 'detail' });
  }, [suspendedDetail, runtime]);

  useEffect(() => {
    runtime.setReduced(reducedMotion);
  }, [reducedMotion, runtime]);

  // Music link: with Music ON and a ready track the transport runs on the music clock; otherwise on the silent clock.
  // Either way the camera keeps its position (setSource re-anchors), so toggling Music never resets the timeline.
  useEffect(() => {
    const timeline = built.timeline;
    if (!timeline) return;
    let cancelled = false;
    const sync = () => {
      if (!getSoundSnapshot().musicEnabled) {
        setMusicClock(null);
        return;
      }
      void ensureMusicClock(masterCycleS(timeline.cycleS)).then((clock) => {
        if (cancelled || !getSoundSnapshot().musicEnabled) return;
        setMusicClock(clock, clock?.visualLeadMs ?? 0);
        runtime.render();
      });
    };
    sync();
    const unsubscribe = subscribeSound(sync);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [built.timeline, runtime]);

  // Input and environment listeners.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    let lastReducedWheel = 0;
    let drag: { id: number; startX: number; startY: number; lastX: number; lastY: number; active: boolean; stepped: boolean } | null = null;
    let dragged = false;

    const owns = () => {
      const s = runtime.state();
      return s.gateDone && s.suspended.length === 0 && !s.disposed;
    };

    const onWheel = (event: WheelEvent) => {
      if (!owns()) return;
      const px = normalizeWheelDelta(event, window.innerHeight);
      if (px === 0) return;
      event.preventDefault();
      const s = runtime.state();
      if (s.reducedMotion) {
        const now = performance.now();
        if (now - lastReducedWheel < REDUCED_WHEEL_GAP_MS) return;
        lastReducedWheel = now;
      }
      runtime.dispatch({ type: 'WHEEL', deltaS: wheelToTimelineSeconds(px) });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!owns() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if ((event.target as Element | null)?.closest('button')) return;
      // Leave the browser's edge gestures (back/forward swipe) alone.
      if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return;
      dragged = false;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, active: false, stepped: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        dragged = true;
        root.setPointerCapture?.(event.pointerId);
        root.dataset.dragging = 'true';
      }
      const stepX = event.clientX - drag.lastX;
      const stepY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      // Dominant axis; dragging up/left moves forward, like touch scrolling.
      const px = -(Math.abs(dx) > Math.abs(dy) ? stepX : stepY);
      if (px === 0 || !owns()) return;
      if (runtime.state().reducedMotion) {
        if (drag.stepped) return;
        drag.stepped = true;
      }
      runtime.dispatch({ type: 'WHEEL', deltaS: wheelToTimelineSeconds(px) });
    };
    const endDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
      delete root.dataset.dragging;
      drag = null;
      window.setTimeout(() => {
        dragged = false;
      }, 0);
    };
    // A drag must not open the work it ended on.
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !owns()) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        runtime.dispatch({ type: 'NAV', dir: event.key === 'ArrowRight' ? 1 : -1 });
      } else if ((event.key === ' ' || event.key === 'k') && !(event.target as Element | null)?.closest('button')) {
        event.preventDefault();
        runtime.dispatch({ type: 'TOGGLE_PAUSE' });
      }
    };

    const onVisibility = () => {
      runtime.dispatch(document.visibilityState === 'hidden' ? { type: 'SUSPEND', reason: 'hidden' } : { type: 'RESUME', reason: 'hidden' });
    };
    const onTransition = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
      if (phase === 'exit-start') runtime.dispatch({ type: 'SUSPEND', reason: 'route' });
      else if (phase === 'enter-end' || phase === 'recovered') runtime.dispatch({ type: 'RESUME', reason: 'route' });
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('click', onClickCapture, true);
    root.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener(transitionEvents.transition, onTransition);
    if (document.visibilityState === 'hidden') onVisibility();
    // Arriving while a route transition is still entering: wait for it to end.
    if (html.dataset.transitionState) runtime.dispatch({ type: 'SUSPEND', reason: 'route' });

    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endDrag);
      root.removeEventListener('pointercancel', endDrag);
      root.removeEventListener('click', onClickCapture, true);
      root.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener(transitionEvents.transition, onTransition);
      delete root.dataset.dragging;
    };
  }, [runtime]);

  // Development handle for inspection and scripted QA (not present in production builds).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const { timeline } = liveRef.current;
    window.__t9Showroom = {
      dispatch: runtime.dispatch,
      state: runtime.state,
      nav: runtime.nav,
      position: () => (timeline ? transportFor(timeline).position() : null),
      playing: () => (timeline ? transportFor(timeline).isPlaying() : false),
      scene: () => {
        const tl = liveRef.current.timeline;
        return tl ? sceneAt(tl, transportFor(tl).visualPosition(), runtime.nav()?.variant ?? 'forward') : null;
      },
      cycleS: () => liveRef.current.timeline?.cycleS ?? 0,
      masterCycleS: () => (liveRef.current.timeline ? masterCycleS(liveRef.current.timeline.cycleS) : 0),
      clock: activeClock,
      visualPosition: () => (timeline ? transportFor(timeline).visualPosition() : null),
      seek: (t: number) => {
        const tl = liveRef.current.timeline;
        if (tl) transportFor(tl).seek(t);
        runtime.render();
      },
    };
    return () => {
      delete window.__t9Showroom;
    };
  }, [runtime, built.timeline]);

  const registerAnchor = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) anchorEls.current.set(slug, el);
    else anchorEls.current.delete(slug);
  }, []);
  const registerFragment = useCallback((id: string, el: HTMLElement | null) => {
    if (el) fragmentEls.current.set(id, el);
    else fragmentEls.current.delete(id);
  }, []);

  const hoverEnter = useCallback(
    (slug: string) => runtime.dispatch({ type: 'HOVER_ENTER', activeDisplay: slug === runtime.activeSlug() }),
    [runtime],
  );
  const hoverLeave = useCallback(() => runtime.dispatch({ type: 'HOVER_LEAVE' }), [runtime]);
  const next = useCallback(() => runtime.dispatch({ type: 'NAV', dir: 1 }), [runtime]);
  const prev = useCallback(() => runtime.dispatch({ type: 'NAV', dir: -1 }), [runtime]);
  const togglePause = useCallback(() => runtime.dispatch({ type: 'TOGGLE_PAUSE' }), [runtime]);

  return {
    rootRef,
    cameraRef,
    registerAnchor,
    registerFragment,
    profile,
    scale,
    fragments,
    timeline: built.timeline,
    error: built.error,
    ui,
    hoverEnter,
    hoverLeave,
    next,
    prev,
    togglePause,
    anchorStyle: (anchor: { x: number; y: number; z: number; yaw: number; roll: number }) =>
      anchorTransform({ ...anchor, x: anchor.x * scale, y: anchor.y * scale, z: anchor.z * scale }),
  };
}

declare global {
  interface Window {
    /** Development-only handle for scripted QA of the showroom runtime. */
    __t9Showroom?: {
      dispatch: (event: ControllerEvent) => void;
      state: () => ControllerState;
      nav: () => NavPlan | null;
      position: () => number | null;
      playing: () => boolean;
      scene: () => ReturnType<typeof sceneAt> | null;
      cycleS: () => number;
      masterCycleS: () => number;
      clock: () => 'music' | 'silent';
      visualPosition: () => number | null;
      seek: (t: number) => void;
    };
  }
}
