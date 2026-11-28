import assert from 'node:assert/strict';
import { test } from 'node:test';
import { equalPowerCurve, loopPeriod, planSongSegments, segmentAt } from '../src/audio/loopPlan.ts';

const input = { whenS: 10, offsetS: 0, durationS: 200, crossfadeS: 2 };

test('the first segment plays the whole file, then each next one starts a crossfade before the end', () => {
  const [a, b, c] = planSongSegments(input, 10 + 600);
  assert.deepEqual([a.startAt, a.offset, a.endAt], [10, 0, 210]);
  assert.equal(a.fadeIn, null);
  assert.deepEqual(a.fadeOut, { from: 208, to: 210 });
  assert.deepEqual([b.startAt, b.offset, b.endAt], [208, 0, 408]);
  assert.deepEqual(b.fadeIn, { from: 208, to: 210 });
  assert.equal(c.startAt - b.startAt, loopPeriod(input));
});

test('every fade-in coincides with the previous fade-out (seamless seam)', () => {
  const segments = planSongSegments(input, 10 + 2000);
  for (let i = 1; i < segments.length; i += 1) assert.deepEqual(segments[i].fadeIn, segments[i - 1].fadeOut);
});

test('a resumed start offset shortens only the first segment', () => {
  const resumed = { ...input, offsetS: 150 };
  assert.equal(segmentAt(resumed, 0).endAt, 10 + 50);
  assert.equal(segmentAt(resumed, 1).startAt, 10 + 50 - 2);
});

test('scheduling continues from an index and stops at the horizon', () => {
  const first = planSongSegments(input, 300);
  assert.deepEqual(first.map((s) => s.index), [0, 1]);
  assert.deepEqual(planSongSegments(input, 300, 2), []);
  assert.deepEqual(planSongSegments({ ...input, durationS: 3 }, 100), [], 'too short to crossfade');
});

test('equal-power curves keep constant power', () => {
  const a = equalPowerCurve(16, 'in');
  const b = equalPowerCurve(16, 'out');
  for (let i = 0; i < 16; i += 1) assert.ok(Math.abs(a[i] ** 2 + b[i] ** 2 - 1) < 1e-6);
});
