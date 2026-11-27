import { clamp } from './time.ts';

/*
 * Input-ownership controller: a pure reducer `(state, event, policy) -> { state, effects }`. It never touches the
 * DOM, audio or timers; the hook executes the returned effects.
 *
 * Priority (high -> low): SUSPENDED > USER_PAUSED > DISCRETE_NAV > SCRUBBING > HOVER_PAUSED > AUTOPLAY.
 * It is encoded by the structure below (overlays gate everything; one `owner` at a time) rather than as data.
 *
 * Which behaviours are fixed and which are policy:
 *  - Fixed (owner decisions): suspension wins; manual pause is not cancelled by hover; hover pauses only the active
 *    display while HOLDing; wheel never interrupts Prev/Next (at most one bounded scroll intent is kept);
 *    reduced motion = static camera, music may still play.
 *  - ControllerPolicy (RECOMMENDATIONS R-UP, R-HUP, R-HOLD, R-INT, R-TIME): swap the defaults to follow the
 *    owner's final choice without touching the reducer.
 *
 * Every owner change bumps `generation`. Timer effects carry the generation they were started in; their events
 * are ignored when it no longer matches, so a stale timer/animation callback can never act on newer state.
 */

export type Owner = 'AUTOPLAY' | 'HOVER_PAUSED' | 'SCRUBBING' | 'DISCRETE_NAV';
export type SuspendReason = 'detail' | 'list' | 'hidden' | 'route';
export type NavDir = 1 | -1;
export type Phase = 'hold' | 'transit';
export type PendingIntent = { kind: 'nav'; dir: NavDir } | { kind: 'scroll'; deltaS: number };
export type ControllerMode = 'INTRO' | 'RUNNING' | 'STATIC';

export interface ControllerPolicy {
  /** R-UP (a): Prev/Next and scroll still move the visual while USER_PAUSED (they never resume autoplay). */
  userPausedAllowsNav: boolean;
  /** R-UP (b): a Prev/Next run while USER_PAUSED mutes the music; the transport pauses again on arrival. */
  navWhilePausedMutesMusic: boolean;
  /** R-HUP: hover does nothing (no SFX) while the user has paused manually. */
  hoverIgnoredWhenPaused: boolean;
  /** R-HOLD: hover pauses only the active display during HOLD. */
  hoverOnlyActiveHold: boolean;
  /** R-INT: a queued Prev/Next beats a queued scroll intent. */
  navIntentBeatsScroll: boolean;
  /** R-TIME: bound of the single stored scroll intent, in timeline seconds (prototype: one cue span). */
  maxIntentS: number;
  /** R-TIME. */
  hoverDebounceMs: number;
  /** R-TIME. */
  scrubIdleMs: number;
}

export const DEFAULT_POLICY: ControllerPolicy = {
  userPausedAllowsNav: true,
  navWhilePausedMutesMusic: true,
  hoverIgnoredWhenPaused: true,
  hoverOnlyActiveHold: true,
  navIntentBeatsScroll: true,
  maxIntentS: 6,
  hoverDebounceMs: 200,
  scrubIdleMs: 180,
};

export interface ControllerState {
  gateDone: boolean;
  reducedMotion: boolean;
  disposed: boolean;
  owner: Owner;
  phase: Phase;
  suspended: readonly SuspendReason[];
  userPaused: boolean;
  pending: PendingIntent | null;
  generation: number;
  scrubDir: -1 | 0 | 1;
  musicMuted: boolean;
}

export function initialControllerState(reducedMotion = false): ControllerState {
  return {
    gateDone: false,
    reducedMotion,
    disposed: false,
    owner: 'AUTOPLAY',
    phase: 'hold',
    suspended: [],
    userPaused: false,
    pending: null,
    generation: 0,
    scrubDir: 0,
    musicMuted: false,
  };
}

export type ControllerEvent =
  | { type: 'GATE_DONE' }
  | { type: 'REDUCED_MOTION'; on: boolean }
  | { type: 'PHASE'; phase: Phase }
  | { type: 'HOVER_ENTER'; activeDisplay: boolean }
  | { type: 'HOVER_LEAVE' }
  | { type: 'HOVER_DEBOUNCED'; generation: number }
  | { type: 'WHEEL'; deltaS: number }
  | { type: 'SCRUB_IDLE'; generation: number }
  | { type: 'NAV'; dir: NavDir }
  | { type: 'ARRIVED' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SUSPEND'; reason: SuspendReason }
  | { type: 'RESUME'; reason: SuspendReason }
  | { type: 'UNMOUNT' };

export type Effect =
  | { type: 'transport'; action: 'play' | 'pause' }
  | { type: 'sfx'; name: 'radio-off' | 'radio-on' | 'seek' | 'arrival' }
  | { type: 'music'; action: 'duck' | 'unduck' | 'mute' | 'unmute' }
  | { type: 'scrub'; action: 'start' | 'stop'; dir?: 1 | -1 }
  | { type: 'scrubBy'; deltaS: number }
  /** Seek the music to the visual position (the transport is the single clock, so this is transport.seek(position)). */
  | { type: 'align' }
  /** Seek to the navigation window and let the fixed transition play; completion is reported as ARRIVED. */
  | { type: 'navigate'; dir: NavDir }
  /** Static camera (reduced motion): cut to the adjacent work. */
  | { type: 'staticStep'; dir: NavDir }
  | { type: 'seekToHold' }
  | { type: 'jumpToArrival' }
  | { type: 'timer'; action: 'start'; name: 'hoverLeave' | 'scrubIdle'; ms: number; generation: number }
  | { type: 'timer'; action: 'cancel'; name: 'hoverLeave' | 'scrubIdle' }
  | { type: 'teardown' };

export interface ReduceResult {
  state: ControllerState;
  effects: Effect[];
}

export function controllerMode(state: ControllerState): ControllerMode {
  if (!state.gateDone) return 'INTRO';
  return state.reducedMotion ? 'STATIC' : 'RUNNING';
}

/** Whether the master transport should be running in this state. */
export function shouldPlay(state: ControllerState): boolean {
  if (state.disposed || !state.gateDone || state.suspended.length > 0) return false;
  // Static camera: the clock (and so the music) follows play/pause only.
  if (state.reducedMotion) return !state.userPaused;
  switch (state.owner) {
    case 'HOVER_PAUSED':
    case 'SCRUBBING':
      return false;
    case 'DISCRETE_NAV':
      return true;
    case 'AUTOPLAY':
      return !state.userPaused;
  }
}

const NONE = (state: ControllerState): ReduceResult => ({ state, effects: [] });

const bump = (state: ControllerState, patch: Partial<ControllerState>): ControllerState => ({
  ...state,
  ...patch,
  generation: state.generation + 1,
});

/** Effects that undo whatever the current owner had set up (timers, scrub voice, ducking). */
function leaveOwner(state: ControllerState): Effect[] {
  switch (state.owner) {
    case 'HOVER_PAUSED':
      return [{ type: 'timer', action: 'cancel', name: 'hoverLeave' }];
    case 'SCRUBBING':
      return [
        { type: 'timer', action: 'cancel', name: 'scrubIdle' },
        { type: 'scrub', action: 'stop' },
        { type: 'music', action: 'unduck' },
      ];
    default:
      return [];
  }
}

function canNavigate(state: ControllerState, policy: ControllerPolicy): boolean {
  return state.gateDone && !state.reducedMotion && state.suspended.length === 0 && (!state.userPaused || policy.userPausedAllowsNav);
}

function startNav(state: ControllerState, dir: NavDir, policy: ControllerPolicy): ReduceResult {
  const mute = state.userPaused && policy.navWhilePausedMutesMusic;
  const effects: Effect[] = [...leaveOwner(state)];
  if (mute && !state.musicMuted) effects.push({ type: 'music', action: 'mute' });
  effects.push({ type: 'sfx', name: 'seek' }, { type: 'navigate', dir });
  return {
    state: bump(state, { owner: 'DISCRETE_NAV', pending: null, scrubDir: 0, musicMuted: mute || state.musicMuted }),
    effects,
  };
}

function startScrub(state: ControllerState, deltaS: number, policy: ControllerPolicy): ReduceResult {
  const dir: 1 | -1 = deltaS > 0 ? 1 : -1;
  const effects: Effect[] = [];
  let next = state;
  if (state.owner !== 'SCRUBBING') {
    effects.push(...leaveOwner(state), { type: 'music', action: 'duck' });
    next = bump(state, { owner: 'SCRUBBING', pending: null, scrubDir: 0 });
  }
  if (next.scrubDir !== dir) {
    effects.push({ type: 'scrub', action: 'start', dir });
    next = { ...next, scrubDir: dir };
  }
  effects.push(
    { type: 'scrubBy', deltaS },
    { type: 'timer', action: 'cancel', name: 'scrubIdle' },
    { type: 'timer', action: 'start', name: 'scrubIdle', ms: policy.scrubIdleMs, generation: next.generation },
  );
  return { state: next, effects };
}

function step(state: ControllerState, event: ControllerEvent, policy: ControllerPolicy): ReduceResult {
  if (state.disposed) return NONE(state);

  switch (event.type) {
    case 'GATE_DONE':
      return state.gateDone ? NONE(state) : { state: { ...state, gateDone: true }, effects: [] };

    case 'REDUCED_MOTION': {
      if (state.reducedMotion === event.on) return NONE(state);
      const effects: Effect[] = [...leaveOwner(state)];
      if (state.musicMuted) effects.push({ type: 'music', action: 'unmute' });
      effects.push({ type: 'seekToHold' });
      return {
        state: bump(state, { reducedMotion: event.on, owner: 'AUTOPLAY', pending: null, scrubDir: 0, musicMuted: false }),
        effects,
      };
    }

    case 'PHASE': {
      if (state.phase === event.phase) return NONE(state);
      const next = { ...state, phase: event.phase };
      if (event.phase === 'hold' && next.owner === 'AUTOPLAY' && next.pending?.kind === 'nav' && !next.userPaused && canNavigate(next, policy)) {
        return startNav(next, next.pending.dir, policy);
      }
      return { state: next, effects: [] };
    }

    case 'HOVER_ENTER': {
      if (state.reducedMotion || !state.gateDone || state.suspended.length > 0) return NONE(state);
      if (state.owner === 'HOVER_PAUSED') {
        // Re-entered before the leave debounce fired: stay paused, invalidate the pending leave, no SFX.
        return { state: bump(state, {}), effects: [{ type: 'timer', action: 'cancel', name: 'hoverLeave' }] };
      }
      if (state.owner !== 'AUTOPLAY') return NONE(state);
      if (policy.hoverOnlyActiveHold && !(event.activeDisplay && state.phase === 'hold')) return NONE(state);
      if (state.userPaused && policy.hoverIgnoredWhenPaused) return NONE(state);
      return { state: bump(state, { owner: 'HOVER_PAUSED' }), effects: [{ type: 'sfx', name: 'radio-off' }] };
    }

    case 'HOVER_LEAVE':
      if (state.owner !== 'HOVER_PAUSED') return NONE(state);
      return {
        state,
        effects: [{ type: 'timer', action: 'start', name: 'hoverLeave', ms: policy.hoverDebounceMs, generation: state.generation }],
      };

    case 'HOVER_DEBOUNCED':
      if (event.generation !== state.generation || state.owner !== 'HOVER_PAUSED') return NONE(state);
      return { state: bump(state, { owner: 'AUTOPLAY' }), effects: [{ type: 'sfx', name: 'radio-on' }] };

    case 'WHEEL': {
      if (!state.gateDone || state.suspended.length > 0 || !Number.isFinite(event.deltaS) || event.deltaS === 0) return NONE(state);
      if (state.reducedMotion) return { state, effects: [{ type: 'staticStep', dir: event.deltaS > 0 ? 1 : -1 }] };
      if (state.userPaused && !policy.userPausedAllowsNav) return NONE(state);
      if (state.owner === 'DISCRETE_NAV') {
        // Never interrupt the running transition: keep at most one bounded scroll intent for after arrival.
        if (state.pending?.kind === 'nav' && policy.navIntentBeatsScroll) return NONE(state);
        const base = state.pending?.kind === 'scroll' ? state.pending.deltaS : 0;
        const deltaS = clamp(base + event.deltaS, -policy.maxIntentS, policy.maxIntentS);
        return { state: { ...state, pending: { kind: 'scroll', deltaS } }, effects: [] };
      }
      return startScrub(state, event.deltaS, policy);
    }

    case 'SCRUB_IDLE':
      if (event.generation !== state.generation || state.owner !== 'SCRUBBING') return NONE(state);
      return {
        state: bump(state, { owner: 'AUTOPLAY', scrubDir: 0 }),
        effects: [{ type: 'scrub', action: 'stop' }, { type: 'music', action: 'unduck' }, { type: 'align' }],
      };

    case 'NAV': {
      if (!state.gateDone || state.suspended.length > 0) return NONE(state);
      if (state.reducedMotion) return { state, effects: [{ type: 'staticStep', dir: event.dir }] };
      if (state.userPaused && !policy.userPausedAllowsNav) return NONE(state);
      if (state.owner === 'DISCRETE_NAV') {
        // One queued intent at most; the latest Prev/Next wins. A queued scroll survives only if nav does not beat it.
        if (state.pending?.kind === 'scroll' && !policy.navIntentBeatsScroll) return NONE(state);
        return { state: { ...state, pending: { kind: 'nav', dir: event.dir } }, effects: [] };
      }
      if (state.owner === 'AUTOPLAY' && state.phase === 'transit' && !state.userPaused) {
        return { state: { ...state, pending: { kind: 'nav', dir: event.dir } }, effects: [] };
      }
      return startNav(state, event.dir, policy);
    }

    case 'ARRIVED': {
      if (state.owner !== 'DISCRETE_NAV') return NONE(state);
      const effects: Effect[] = [];
      if (state.musicMuted) effects.push({ type: 'music', action: 'unmute' });
      effects.push({ type: 'sfx', name: 'arrival' });
      const settled = bump(state, { owner: 'AUTOPLAY', phase: 'hold', pending: null, scrubDir: 0, musicMuted: false });
      const pending = state.pending;
      if (pending?.kind === 'nav' && canNavigate(settled, policy)) {
        const next = startNav(settled, pending.dir, policy);
        return { state: next.state, effects: [...effects, ...next.effects] };
      }
      if (pending?.kind === 'scroll' && canNavigate(settled, policy)) {
        const next = startScrub(settled, pending.deltaS, policy);
        return { state: next.state, effects: [...effects, ...next.effects] };
      }
      return { state: settled, effects };
    }

    case 'TOGGLE_PAUSE': {
      if (!state.gateDone) return NONE(state);
      if (!state.userPaused) {
        let next: ControllerState = { ...state, userPaused: true };
        const effects: Effect[] = [];
        if (state.owner === 'HOVER_PAUSED') {
          // The hover state is discarded; the manual pause now owns the transport.
          next = bump(next, { owner: 'AUTOPLAY' });
          effects.push({ type: 'timer', action: 'cancel', name: 'hoverLeave' });
        } else if (state.owner === 'DISCRETE_NAV' && policy.navWhilePausedMutesMusic && !state.musicMuted) {
          next = { ...next, musicMuted: true };
          effects.push({ type: 'music', action: 'mute' });
        }
        return { state: next, effects };
      }
      const effects: Effect[] = state.owner === 'DISCRETE_NAV' && state.musicMuted ? [{ type: 'music', action: 'unmute' }] : [];
      return { state: { ...state, userPaused: false, musicMuted: state.owner === 'DISCRETE_NAV' ? false : state.musicMuted }, effects };
    }

    case 'SUSPEND': {
      if (state.suspended.includes(event.reason)) return NONE(state);
      const suspended = [...state.suspended, event.reason].sort();
      if (state.suspended.length > 0) return { state: { ...state, suspended }, effects: [] };
      // First suspension: collapse any active owner, keep the position (the transport pauses via shouldPlay).
      const effects: Effect[] = [...leaveOwner(state)];
      if (state.owner === 'DISCRETE_NAV') effects.push({ type: 'jumpToArrival' });
      if (state.musicMuted) effects.push({ type: 'music', action: 'unmute' });
      return {
        state: bump(state, { suspended, owner: 'AUTOPLAY', pending: null, scrubDir: 0, musicMuted: false }),
        effects,
      };
    }

    case 'RESUME': {
      if (!state.suspended.includes(event.reason)) return NONE(state);
      return { state: { ...state, suspended: state.suspended.filter((r) => r !== event.reason) }, effects: [] };
    }

    case 'UNMOUNT': {
      const effects: Effect[] = [
        { type: 'timer', action: 'cancel', name: 'hoverLeave' },
        { type: 'timer', action: 'cancel', name: 'scrubIdle' },
        { type: 'scrub', action: 'stop' },
        { type: 'music', action: 'unduck' },
        { type: 'music', action: 'unmute' },
        { type: 'teardown' },
      ];
      return { state: bump(state, { disposed: true, owner: 'AUTOPLAY', pending: null, scrubDir: 0, musicMuted: false }), effects };
    }
  }
}

/**
 * Reducer. After each step the transport effect is derived from shouldPlay(): `pause` is placed first (so a seek
 * never restarts audio just to pause it) and `play` last (so seeks/aligns happen before audio starts).
 */
export function reduce(state: ControllerState, event: ControllerEvent, policy: ControllerPolicy = DEFAULT_POLICY): ReduceResult {
  const out = step(state, event, policy);
  const was = shouldPlay(state);
  const now = shouldPlay(out.state);
  if (was === now) return out;
  return now
    ? { state: out.state, effects: [...out.effects, { type: 'transport', action: 'play' }] }
    : { state: out.state, effects: [{ type: 'transport', action: 'pause' }, ...out.effects] };
}
