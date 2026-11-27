import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profile } from '../src/data/profile.ts';
import { accumulate, drain, FILL_DISTANCE_PX, isAtBottom, isComplete, normalizeWheel } from '../src/utils/nextProgress.ts';

test('wheel deltas are normalised to px and clamped', () => {
  assert.equal(normalizeWheel(100, 0, 800), 100);
  assert.equal(normalizeWheel(3, 1, 800), 54);
  assert.equal(normalizeWheel(1, 2, 800), 240, 'one page is clamped');
  assert.equal(normalizeWheel(-500, 0, 800), -240);
  assert.equal(normalizeWheel(Number.NaN, 0, 800), 0);
});

test('scrolling down fills the bar, scrolling up empties it, both clamped', () => {
  assert.equal(accumulate(0, FILL_DISTANCE_PX / 2), 0.5);
  assert.equal(accumulate(0.9, FILL_DISTANCE_PX), 1);
  assert.equal(accumulate(0.1, -FILL_DISTANCE_PX), 0);
  assert.equal(accumulate(0.3, Number.NaN), 0.3);
});

test('the bar drains when idle and completes only when full', () => {
  assert.ok(Math.abs(drain(0.5, 1, 0.45) - 0.05) < 1e-9);
  assert.equal(drain(0.1, 10), 0);
  assert.equal(drain(0.4, -1), 0.4);
  assert.equal(isComplete(0.999), false);
  assert.equal(isComplete(1), true);
});

test('bottom detection tolerates sub-pixel scroll positions', () => {
  assert.equal(isAtBottom(1199, 800, 2000), true);
  assert.equal(isAtBottom(1100, 800, 2000), false);
});

test('socials: the Pertemuan 1 links, with YouTube moved to @p_ftttt (owner, round 3)', () => {
  assert.deepEqual(
    profile.socials.map((s) => s.url),
    ['https://github.com/kxrumii', 'https://instagram.com/p_ftttt', 'https://tiktok.com/@p_ftttt', 'https://www.youtube.com/@p_ftttt'],
  );
  assert.equal(profile.email, null, 'no e-mail is published');
  assert.equal(profile.handle, 'Fahrii');
  assert.equal(profile.tagline, 'developer & editor');
});
