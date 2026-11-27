import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_POLICY,
  controllerMode,
  initialControllerState,
  reduce,
  shouldPlay,
  type ControllerEvent,
  type ControllerPolicy,
  type ControllerState,
  type Effect,
} from '../src/showroom/controller.ts';

interface Run {
  state: ControllerState;
  effects: Effect[];
  steps: Effect[][];
}

function run(events: readonly ControllerEvent[], options: { policy?: Partial<ControllerPolicy>; from?: ControllerState } = {}): Run {
  const policy: ControllerPolicy = { ...DEFAULT_POLICY, ...options.policy };
  let state = options.from ?? initialControllerState();
  const steps: Effect[][] = [];
  for (const event of events) {
    const out = reduce(state, event, policy);
    state = out.state;
    steps.push(out.effects);
  }
  return { state, effects: steps.flat(), steps };
}

const running = (...events: ControllerEvent[]) => run([{ type: 'GATE_DONE' }, ...events]);
const has = (effects: readonly Effect[], match: Partial<Effect> & { type: Effect['type'] }) =>
  effects.some((e) => Object.entries(match).every(([k, v]) => (e as unknown as Record<string, unknown>)[k] === v));
const index = (effects: readonly Effect[], match: Partial<Effect> & { type: Effect['type'] }) =>
  effects.findIndex((e) => Object.entries(match).every(([k, v]) => (e as unknown as Record<string, unknown>)[k] === v));
const timerGeneration = (effects: readonly Effect[], name: 'hoverLeave' | 'scrubIdle'): number => {
  const timer = effects.find((e) => e.type === 'timer' && e.action === 'start' && e.name === name);
  assert.ok(timer && timer.type === 'timer' && timer.action === 'start');
  return timer.generation;
};

/* ---------- start-up ---------- */

test('nothing reacts before the sound gate is done; GATE_DONE starts the transport', () => {
  const before = run([{ type: 'NAV', dir: 1 }, { type: 'WHEEL', deltaS: 1 }, { type: 'HOVER_ENTER', activeDisplay: true }]);
  assert.deepEqual(before.effects, []);
  assert.equal(controllerMode(before.state), 'INTRO');
  const after = run([{ type: 'GATE_DONE' }]);
  assert.deepEqual(after.effects, [{ type: 'transport', action: 'play' }]);
  assert.equal(controllerMode(after.state), 'RUNNING');
});

/* ---------- hover ---------- */

test('hover on the active display during HOLD pauses with radio-off; leaving resumes after the debounce with radio-on', () => {
  const entered = running({ type: 'HOVER_ENTER', activeDisplay: true });
  assert.equal(entered.state.owner, 'HOVER_PAUSED');
  const enterEffects = entered.steps[1];
  assert.deepEqual(enterEffects[0], { type: 'transport', action: 'pause' }, 'pause comes first');
  assert.ok(has(enterEffects, { type: 'sfx', name: 'radio-off' }));

  const left = run([{ type: 'HOVER_LEAVE' }], { from: entered.state });
  const generation = timerGeneration(left.effects, 'hoverLeave');
  assert.equal(left.state.owner, 'HOVER_PAUSED', 'still paused until the debounce fires');

  const resumed = run([{ type: 'HOVER_DEBOUNCED', generation }], { from: left.state });
  assert.equal(resumed.state.owner, 'AUTOPLAY');
  assert.ok(has(resumed.effects, { type: 'sfx', name: 'radio-on' }));
  assert.deepEqual(resumed.effects[resumed.effects.length - 1], { type: 'transport', action: 'play' }, 'play comes last');
});

test('re-entering before the leave debounce fires keeps the pause and invalidates the stale timer (no flapping SFX)', () => {
  const s1 = running({ type: 'HOVER_ENTER', activeDisplay: true }, { type: 'HOVER_LEAVE' });
  const staleGeneration = timerGeneration(s1.steps[2], 'hoverLeave');
  const s2 = run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: s1.state });
  assert.equal(s2.state.owner, 'HOVER_PAUSED');
  assert.ok(!has(s2.effects, { type: 'sfx', name: 'radio-off' }));
  const s3 = run([{ type: 'HOVER_DEBOUNCED', generation: staleGeneration }], { from: s2.state });
  assert.equal(s3.state.owner, 'HOVER_PAUSED');
  assert.deepEqual(s3.effects, []);
});

test('hover is ignored during TRANSIT and on non-active displays [C: R-HOLD]', () => {
  const transit = running({ type: 'PHASE', phase: 'transit' }, { type: 'HOVER_ENTER', activeDisplay: true });
  assert.equal(transit.state.owner, 'AUTOPLAY');
  assert.ok(!has(transit.effects, { type: 'sfx', name: 'radio-off' }));
  const inactive = running({ type: 'HOVER_ENTER', activeDisplay: false });
  assert.equal(inactive.state.owner, 'AUTOPLAY');
  // With the policy relaxed the same input does pause.
  const relaxed = run([{ type: 'GATE_DONE' }, { type: 'PHASE', phase: 'transit' }, { type: 'HOVER_ENTER', activeDisplay: false }], {
    policy: { hoverOnlyActiveHold: false },
  });
  assert.equal(relaxed.state.owner, 'HOVER_PAUSED');
});

/* ---------- manual pause ---------- */

test('manual Pause pauses the transport and is not cancelled by hover [C: R-HUP]', () => {
  const paused = running({ type: 'TOGGLE_PAUSE' });
  assert.equal(paused.state.userPaused, true);
  assert.ok(has(paused.steps[1], { type: 'transport', action: 'pause' }));
  const hover = run([{ type: 'HOVER_ENTER', activeDisplay: true }, { type: 'HOVER_LEAVE' }], { from: paused.state });
  assert.deepEqual(hover.effects, [], 'no SFX, no state change');
  assert.equal(hover.state.userPaused, true);
  assert.equal(hover.state.owner, 'AUTOPLAY');
  // Alternative policy: hover still reacts but the manual pause stays.
  const alt = run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: paused.state, policy: { hoverIgnoredWhenPaused: false } });
  assert.equal(alt.state.owner, 'HOVER_PAUSED');
  assert.equal(alt.state.userPaused, true);
  assert.ok(has(alt.effects, { type: 'sfx', name: 'radio-off' }));
  assert.ok(!has(alt.effects, { type: 'transport', action: 'play' }) && !has(alt.effects, { type: 'transport', action: 'pause' }));
});

test('pressing Pause while hovering discards the hover; Play resumes', () => {
  const hovering = running({ type: 'HOVER_ENTER', activeDisplay: true });
  const paused = run([{ type: 'TOGGLE_PAUSE' }], { from: hovering.state });
  assert.equal(paused.state.owner, 'AUTOPLAY');
  assert.equal(paused.state.userPaused, true);
  assert.ok(has(paused.effects, { type: 'timer', action: 'cancel', name: 'hoverLeave' }));
  assert.ok(!has(paused.effects, { type: 'transport', action: 'play' }), 'stays paused');
  const resumed = run([{ type: 'TOGGLE_PAUSE' }], { from: paused.state });
  assert.deepEqual(resumed.effects, [{ type: 'transport', action: 'play' }]);
});

/* ---------- scrubbing ---------- */

test('wheel takes over: duck, tape SFX, scrub; releasing aligns the music before the transport plays again', () => {
  const first = running({ type: 'WHEEL', deltaS: 0.3 });
  assert.equal(first.state.owner, 'SCRUBBING');
  const e1 = first.steps[1];
  assert.deepEqual(e1[0], { type: 'transport', action: 'pause' });
  assert.ok(has(e1, { type: 'music', action: 'duck' }));
  assert.ok(has(e1, { type: 'scrub', action: 'start', dir: 1 }));
  assert.ok(has(e1, { type: 'scrubBy', deltaS: 0.3 }));
  const generation = timerGeneration(e1, 'scrubIdle');

  const same = run([{ type: 'WHEEL', deltaS: 0.1 }], { from: first.state });
  assert.ok(!has(same.effects, { type: 'scrub', action: 'start' }), 'direction unchanged: no restart of the tape voice');
  const reverse = run([{ type: 'WHEEL', deltaS: -0.2 }], { from: first.state });
  assert.ok(has(reverse.effects, { type: 'scrub', action: 'start', dir: -1 }));

  const settled = run([{ type: 'SCRUB_IDLE', generation }], { from: first.state });
  assert.equal(settled.state.owner, 'AUTOPLAY');
  assert.ok(index(settled.effects, { type: 'align' }) < index(settled.effects, { type: 'transport', action: 'play' }));
  assert.ok(has(settled.effects, { type: 'scrub', action: 'stop' }) && has(settled.effects, { type: 'music', action: 'unduck' }));
  // A stale idle event from before the owner changed does nothing.
  assert.deepEqual(run([{ type: 'SCRUB_IDLE', generation }], { from: settled.state }).effects, []);
});

test('scrubbing beats hover: wheel during hover scrubs; hover during scrubbing is ignored', () => {
  const hovering = running({ type: 'HOVER_ENTER', activeDisplay: true });
  const scrub = run([{ type: 'WHEEL', deltaS: 0.2 }], { from: hovering.state });
  assert.equal(scrub.state.owner, 'SCRUBBING');
  assert.ok(has(scrub.effects, { type: 'timer', action: 'cancel', name: 'hoverLeave' }));
  const hoverAgain = run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: scrub.state });
  assert.equal(hoverAgain.state.owner, 'SCRUBBING');
  assert.deepEqual(hoverAgain.effects, []);
});

/* ---------- discrete navigation ---------- */

test('Previous/Next at HOLD starts one navigation (seek SFX, navigate); ARRIVED returns to AUTOPLAY', () => {
  const nav = running({ type: 'NAV', dir: 1 });
  assert.equal(nav.state.owner, 'DISCRETE_NAV');
  assert.deepEqual(nav.steps[1], [{ type: 'sfx', name: 'seek' }, { type: 'navigate', dir: 1 }], 'already playing: no transport change');
  const arrived = run([{ type: 'ARRIVED' }], { from: nav.state });
  assert.equal(arrived.state.owner, 'AUTOPLAY');
  assert.ok(has(arrived.effects, { type: 'sfx', name: 'arrival' }));
});

test('Next during an autoplay TRANSIT waits for arrival, then runs', () => {
  const queued = running({ type: 'PHASE', phase: 'transit' }, { type: 'NAV', dir: 1 });
  assert.equal(queued.state.owner, 'AUTOPLAY');
  assert.deepEqual(queued.state.pending, { kind: 'nav', dir: 1 });
  assert.deepEqual(queued.steps[2], []);
  const started = run([{ type: 'PHASE', phase: 'hold' }], { from: queued.state });
  assert.equal(started.state.owner, 'DISCRETE_NAV');
  assert.ok(has(started.effects, { type: 'navigate', dir: 1 }));
});

test('rapid Prev/Next: at most one queued intent, the latest wins, then it runs after arrival', () => {
  const nav = running({ type: 'NAV', dir: 1 }, { type: 'NAV', dir: 1 }, { type: 'NAV', dir: -1 }, { type: 'NAV', dir: 1 });
  assert.equal(nav.state.owner, 'DISCRETE_NAV');
  assert.deepEqual(nav.state.pending, { kind: 'nav', dir: 1 });
  assert.equal(nav.effects.filter((e) => e.type === 'navigate').length, 1, 'only one navigation started');
  const arrived = run([{ type: 'ARRIVED' }], { from: nav.state });
  assert.equal(arrived.state.owner, 'DISCRETE_NAV');
  assert.ok(has(arrived.effects, { type: 'navigate', dir: 1 }));
  assert.equal(arrived.state.pending, null);
});

test('wheel never interrupts a running navigation; one bounded scroll intent is kept and applied after arrival', () => {
  const nav = running({ type: 'NAV', dir: 1 });
  const wheel = run([{ type: 'WHEEL', deltaS: 4 }, { type: 'WHEEL', deltaS: 4 }], { from: nav.state });
  assert.equal(wheel.state.owner, 'DISCRETE_NAV');
  assert.deepEqual(wheel.effects, [], 'no scrub effects while navigating');
  assert.deepEqual(wheel.state.pending, { kind: 'scroll', deltaS: DEFAULT_POLICY.maxIntentS }, 'clamped, not accumulated without bound');
  const negative = run([{ type: 'WHEEL', deltaS: -50 }], { from: nav.state });
  assert.deepEqual(negative.state.pending, { kind: 'scroll', deltaS: -DEFAULT_POLICY.maxIntentS });

  const arrived = run([{ type: 'ARRIVED' }], { from: wheel.state });
  assert.equal(arrived.state.owner, 'SCRUBBING');
  assert.ok(has(arrived.effects, { type: 'scrubBy', deltaS: DEFAULT_POLICY.maxIntentS }));
});

test('queued nav versus queued scroll [C: R-INT]', () => {
  const nav = running({ type: 'NAV', dir: 1 });
  const scrollQueued = run([{ type: 'WHEEL', deltaS: 1 }], { from: nav.state });
  // Default: Prev/Next beats a queued scroll.
  const replaced = run([{ type: 'NAV', dir: -1 }], { from: scrollQueued.state });
  assert.deepEqual(replaced.state.pending, { kind: 'nav', dir: -1 });
  // And a wheel does not replace a queued navigation.
  const wheelAfterNav = run([{ type: 'WHEEL', deltaS: 1 }], { from: replaced.state });
  assert.deepEqual(wheelAfterNav.state.pending, { kind: 'nav', dir: -1 });
  // Alternative policy: scroll wins over a queued nav, and nav does not replace a queued scroll.
  const alt = { navIntentBeatsScroll: false };
  const navQueued = run([{ type: 'GATE_DONE' }, { type: 'NAV', dir: 1 }, { type: 'NAV', dir: 1 }], { policy: alt });
  assert.deepEqual(navQueued.state.pending, { kind: 'nav', dir: 1 });
  const wheelWins = run([{ type: 'WHEEL', deltaS: 1 }], { from: navQueued.state, policy: alt });
  assert.deepEqual(wheelWins.state.pending, { kind: 'scroll', deltaS: 1 });
  const navIgnored = run([{ type: 'NAV', dir: -1 }], { from: wheelWins.state, policy: alt });
  assert.deepEqual(navIgnored.state.pending, { kind: 'scroll', deltaS: 1 });
});

test('Prev/Next cancels an active scrub and hover pause', () => {
  const scrub = running({ type: 'WHEEL', deltaS: 0.2 });
  const nav = run([{ type: 'NAV', dir: -1 }], { from: scrub.state });
  assert.equal(nav.state.owner, 'DISCRETE_NAV');
  assert.ok(has(nav.effects, { type: 'scrub', action: 'stop' }) && has(nav.effects, { type: 'music', action: 'unduck' }));
  assert.ok(index(nav.effects, { type: 'navigate' }) < index(nav.effects, { type: 'transport', action: 'play' }), 'seek before play');

  const hover = running({ type: 'HOVER_ENTER', activeDisplay: true });
  const fromHover = run([{ type: 'NAV', dir: 1 }], { from: hover.state });
  assert.equal(fromHover.state.owner, 'DISCRETE_NAV');
  assert.ok(has(fromHover.effects, { type: 'timer', action: 'cancel', name: 'hoverLeave' }));
});

/* ---------- user pause + navigation [C: R-UP] ---------- */

test('while manually paused Prev/Next still moves the visual, with the music muted, and pauses again on arrival', () => {
  const paused = running({ type: 'TOGGLE_PAUSE' });
  const nav = run([{ type: 'NAV', dir: 1 }], { from: paused.state });
  assert.equal(nav.state.owner, 'DISCRETE_NAV');
  assert.ok(has(nav.effects, { type: 'music', action: 'mute' }));
  assert.deepEqual(nav.effects[nav.effects.length - 1], { type: 'transport', action: 'play' });
  const arrived = run([{ type: 'ARRIVED' }], { from: nav.state });
  assert.equal(arrived.state.userPaused, true);
  assert.ok(has(arrived.effects, { type: 'music', action: 'unmute' }));
  assert.deepEqual(arrived.effects[0], { type: 'transport', action: 'pause' });
});

test('alternative policy: nav and scroll are blocked while manually paused', () => {
  const policy = { userPausedAllowsNav: false };
  const paused = run([{ type: 'GATE_DONE' }, { type: 'TOGGLE_PAUSE' }], { policy });
  assert.deepEqual(run([{ type: 'NAV', dir: 1 }, { type: 'WHEEL', deltaS: 1 }], { from: paused.state, policy }).effects, []);
});

/* ---------- suspension ---------- */

test('suspension beats everything and restores on resume', () => {
  const base = running({ type: 'SUSPEND', reason: 'detail' });
  assert.deepEqual(base.steps[1], [{ type: 'transport', action: 'pause' }]);
  const ignored = run([{ type: 'NAV', dir: 1 }, { type: 'WHEEL', deltaS: 1 }, { type: 'HOVER_ENTER', activeDisplay: true }], { from: base.state });
  assert.deepEqual(ignored.effects, []);
  const resumed = run([{ type: 'RESUME', reason: 'detail' }], { from: base.state });
  assert.deepEqual(resumed.effects, [{ type: 'transport', action: 'play' }]);
});

test('multiple suspend reasons: the transport resumes only when every reason is lifted', () => {
  const both = running({ type: 'SUSPEND', reason: 'hidden' }, { type: 'SUSPEND', reason: 'detail' });
  assert.deepEqual(both.state.suspended, ['detail', 'hidden']);
  const one = run([{ type: 'RESUME', reason: 'hidden' }], { from: both.state });
  assert.deepEqual(one.effects, []);
  const none = run([{ type: 'RESUME', reason: 'detail' }], { from: one.state });
  assert.deepEqual(none.effects, [{ type: 'transport', action: 'play' }]);
  assert.deepEqual(run([{ type: 'RESUME', reason: 'route' }], { from: none.state }).effects, [], 'unknown reason is a no-op');
});

test('suspending during scrub or navigation cleans up and settles the owner', () => {
  const scrub = running({ type: 'WHEEL', deltaS: 0.2 }, { type: 'SUSPEND', reason: 'list' });
  assert.equal(scrub.state.owner, 'AUTOPLAY');
  assert.ok(has(scrub.steps[2], { type: 'scrub', action: 'stop' }) && has(scrub.steps[2], { type: 'music', action: 'unduck' }));
  const nav = running({ type: 'NAV', dir: 1 }, { type: 'SUSPEND', reason: 'detail' });
  assert.equal(nav.state.owner, 'AUTOPLAY');
  assert.ok(has(nav.steps[2], { type: 'jumpToArrival' }));
  assert.equal(nav.state.pending, null);
});

test('hover state is dropped on suspension and the pause flag survives it', () => {
  const hovering = running({ type: 'HOVER_ENTER', activeDisplay: true });
  const suspended = run([{ type: 'SUSPEND', reason: 'detail' }, { type: 'RESUME', reason: 'detail' }], { from: hovering.state });
  assert.equal(suspended.state.owner, 'AUTOPLAY');
  assert.ok(has(suspended.effects, { type: 'transport', action: 'play' }));
  const paused = running({ type: 'TOGGLE_PAUSE' }, { type: 'SUSPEND', reason: 'hidden' }, { type: 'RESUME', reason: 'hidden' });
  assert.equal(paused.state.userPaused, true);
  assert.ok(!has(paused.effects.slice(-1), { type: 'transport', action: 'play' }), 'still manually paused after resuming');
});

/* ---------- reduced motion ---------- */

test('reduced motion: static camera, discrete steps, no hover/scrub, music follows play/pause [C: R-RM]', () => {
  const rm = run([{ type: 'REDUCED_MOTION', on: true }, { type: 'GATE_DONE' }]);
  assert.equal(controllerMode(rm.state), 'STATIC');
  assert.ok(has(rm.effects, { type: 'seekToHold' }));
  assert.ok(shouldPlay(rm.state), 'music may keep playing');
  const out = run([{ type: 'NAV', dir: 1 }, { type: 'WHEEL', deltaS: 2 }, { type: 'HOVER_ENTER', activeDisplay: true }], { from: rm.state });
  assert.deepEqual(out.effects, [{ type: 'staticStep', dir: 1 }, { type: 'staticStep', dir: 1 }]);
  assert.equal(out.state.owner, 'AUTOPLAY');
  const paused = run([{ type: 'TOGGLE_PAUSE' }], { from: rm.state });
  assert.deepEqual(paused.effects, [{ type: 'transport', action: 'pause' }]);
  const off = run([{ type: 'REDUCED_MOTION', on: false }], { from: rm.state });
  assert.equal(controllerMode(off.state), 'RUNNING');
  assert.ok(has(off.effects, { type: 'seekToHold' }));
});

test('toggling reduced motion mid-scrub cleans up the scrub', () => {
  const scrub = running({ type: 'WHEEL', deltaS: 0.2 }, { type: 'REDUCED_MOTION', on: true });
  assert.equal(scrub.state.owner, 'AUTOPLAY');
  assert.ok(has(scrub.steps[2], { type: 'scrub', action: 'stop' }));
});

/* ---------- ownership, generation, teardown ---------- */

test('every owner change bumps the generation', () => {
  const generations: number[] = [];
  let state = initialControllerState();
  const feed = (event: ControllerEvent) => {
    state = reduce(state, event).state;
    generations.push(state.generation);
    return state;
  };
  feed({ type: 'GATE_DONE' });
  const g0 = state.generation;
  feed({ type: 'HOVER_ENTER', activeDisplay: true }); // -> HOVER
  const g1 = state.generation;
  feed({ type: 'WHEEL', deltaS: 0.2 }); // -> SCRUBBING
  const g2 = state.generation;
  feed({ type: 'NAV', dir: 1 }); // -> NAV
  const g3 = state.generation;
  feed({ type: 'ARRIVED' }); // -> AUTOPLAY
  const g4 = state.generation;
  assert.ok(g0 < g1 && g1 < g2 && g2 < g3 && g3 < g4, generations.join(','));
});

test('UNMOUNT tears everything down (pause first, teardown last) and later events are ignored', () => {
  const scrub = running({ type: 'WHEEL', deltaS: 0.2 });
  const gone = run([{ type: 'UNMOUNT' }], { from: scrub.state });
  assert.equal(gone.state.disposed, true);
  assert.ok(has(gone.effects, { type: 'timer', action: 'cancel', name: 'scrubIdle' }));
  assert.ok(has(gone.effects, { type: 'scrub', action: 'stop' }));
  assert.deepEqual(gone.effects[gone.effects.length - 1], { type: 'teardown' });
  const after = run([{ type: 'NAV', dir: 1 }, { type: 'WHEEL', deltaS: 1 }, { type: 'HOVER_ENTER', activeDisplay: true }, { type: 'SCRUB_IDLE', generation: 0 }], { from: gone.state });
  assert.deepEqual(after.effects, []);
  const playing = running({ type: 'UNMOUNT' });
  assert.deepEqual(playing.steps[1][0], { type: 'transport', action: 'pause' });
});

test('priority order SUSPENDED > USER_PAUSED > DISCRETE_NAV > SCRUBBING > HOVER_PAUSED > AUTOPLAY', () => {
  // Each pair: the higher-priority condition wins when both are present.
  const nav = running({ type: 'NAV', dir: 1 });
  assert.equal(run([{ type: 'WHEEL', deltaS: 1 }], { from: nav.state }).state.owner, 'DISCRETE_NAV'); // NAV > SCRUBBING
  assert.equal(run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: nav.state }).state.owner, 'DISCRETE_NAV'); // NAV > HOVER
  const scrub = running({ type: 'WHEEL', deltaS: 1 });
  assert.equal(run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: scrub.state }).state.owner, 'SCRUBBING'); // SCRUBBING > HOVER
  const paused = running({ type: 'TOGGLE_PAUSE' });
  assert.equal(shouldPlay(run([{ type: 'HOVER_ENTER', activeDisplay: true }], { from: paused.state }).state), false); // USER_PAUSED holds
  const suspendedPaused = run([{ type: 'SUSPEND', reason: 'detail' }, { type: 'TOGGLE_PAUSE' }, { type: 'RESUME', reason: 'detail' }], { from: nav.state });
  assert.equal(shouldPlay(suspendedPaused.state), false); // SUSPENDED/USER_PAUSED > everything
});
