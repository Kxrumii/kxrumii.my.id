import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANDSCAPE_PROFILE, PORTRAIT_PROFILE } from '../src/showroom/choreography.ts';
import { cueMapToSchedule, type MusicCueMap } from '../src/showroom/musicCueMap.ts';
import { buildTimeline, validateSchedule } from '../src/showroom/timeline.ts';

/*
 * SYNTHETIC numbers for tests only. They describe no real track, BPM or loop; real cue maps need an owner-approved
 * asset and manually measured timestamps.
 */
const cameraCues = LANDSCAPE_PROFILE.cues.map((cue) => ({
  id: cue.id,
  durationS: LANDSCAPE_PROFILE.segments.find((s) => s.id === cue.outSegmentId)!.durationS,
}));

const relative = [2, 9, 16, 23, 30];
const makeMap = (loopInS: number, loopOutS: number, absolute: readonly number[]): MusicCueMap => ({
  trackId: 'synthetic-test-track',
  source: { kind: 'local-untracked', ref: 'none' },
  loopInS,
  loopOutS,
  bpm: null,
  timeSignature: null,
  calibration: { visualLeadMs: 0 },
  cues: cameraCues.map((cue, i) => ({ id: `m${i}`, cameraCueId: cue.id, transitionStartS: absolute[i] })),
});

test('absolute file timestamps normalise to the loop timeline: (t - loopIn) mod cycle', () => {
  const result = cueMapToSchedule(makeMap(10, 50, relative.map((t) => t + 10)), cameraCues);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.schedule.cycleS, 40);
  assert.deepEqual(result.schedule.transitionStartS, relative);
});

test('the schedule only places transitions: segment durations stay those of the camera segments', () => {
  const result = cueMapToSchedule(makeMap(10, 50, relative.map((t) => t + 10)), cameraCues);
  assert.ok(result.ok);
  if (!result.ok) return;
  for (const profile of [LANDSCAPE_PROFILE, PORTRAIT_PROFILE]) {
    const timeline = buildTimeline(profile, result.schedule);
    timeline.cues.forEach((c, i) => assert.equal(c.durationS, cameraCues[i].durationS));
  }
});

test('the last transition may cross the loop end when the closing hold is long enough', () => {
  // Last transition 38 -> 41.6 crosses 40; closing hold = 4 + 40 - 41.6 = 2.4 s.
  const abs = [4, 9, 16, 23, 38].map((t) => t + 10);
  const result = cueMapToSchedule(makeMap(10, 50, abs), cameraCues);
  assert.ok(result.ok, JSON.stringify(result));
});

test('a closing hold below the minimum is rejected (the cue is wrong, not the animation)', () => {
  const abs = [2, 9, 16, 23, 38].map((t) => t + 10); // closing hold = 2 + 40 - 41.6 = 0.4 s
  const result = cueMapToSchedule(makeMap(10, 50, abs), cameraCues);
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.errors.some((e) => /below the minimum/.test(e)));
});

test('invalid maps are rejected', () => {
  const rel = (t: number[]) => t.map((x) => x + 10);
  const failing = (map: MusicCueMap, pattern: RegExp) => {
    const result = cueMapToSchedule(map, cameraCues);
    assert.ok(!result.ok, pattern.source);
    if (!result.ok) assert.ok(result.errors.some((e) => pattern.test(e)), `${pattern.source}: ${result.errors.join(' | ')}`);
  };
  failing(makeMap(50, 10, rel(relative)), /greater than loopInS/);
  failing(makeMap(10, 50, [9, ...rel(relative).slice(1)]), /outside the loop/);
  failing(makeMap(10, 50, [...rel(relative).slice(0, 4), 50]), /outside the loop/);
  failing(makeMap(10, 50, rel([2, 9, 16, 30, 23])), /strictly increasing/);
  failing(makeMap(10, 50, rel([2, 9, 10.5, 23, 30])), /below the minimum/);
  const missing = makeMap(10, 50, rel(relative));
  failing({ ...missing, cues: missing.cues.slice(1) }, /has no music cue/);
  failing({ ...missing, cues: [...missing.cues, { id: 'x', cameraCueId: 'nope', transitionStartS: 20 }] }, /unknown camera cue/);
  failing({ ...missing, cues: [missing.cues[0], { ...missing.cues[1], cameraCueId: missing.cues[0].cameraCueId }, ...missing.cues.slice(2)] }, /only one music cue/);
});

test('validateSchedule: negative and unordered schedules fail, an exactly minimal hold passes', () => {
  const durations = [2, 2];
  assert.deepEqual(validateSchedule(durations, { cycleS: 10, transitionStartS: [0, 5] }, 1), []);
  assert.ok(validateSchedule(durations, { cycleS: 10, transitionStartS: [5, 0] }, 1).length > 0);
  assert.ok(validateSchedule(durations, { cycleS: 10, transitionStartS: [-1, 5] }, 1).length > 0);
  assert.ok(validateSchedule(durations, { cycleS: 10, transitionStartS: [0] }, 1).length > 0);
  // holds: 5 - 2 = 3 and 0 + 10 - 7 = 3.
  assert.deepEqual(validateSchedule(durations, { cycleS: 10, transitionStartS: [0, 5] }, 3), []);
});
