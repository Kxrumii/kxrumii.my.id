import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerClick, STREAK_WINDOW_MS } from '../src/utils/clickStreak.ts';

test('three quick clicks reach the streak and reset it', () => {
  let s = registerClick([], 0);
  assert.equal(s.reached, false);
  s = registerClick(s.clicks, 300);
  assert.equal(s.reached, false);
  s = registerClick(s.clicks, 700);
  assert.equal(s.reached, true);
  assert.deepEqual(s.clicks, []);
});

test('slow clicks never reach the streak', () => {
  let s = registerClick([], 0);
  s = registerClick(s.clicks, STREAK_WINDOW_MS + 100);
  s = registerClick(s.clicks, STREAK_WINDOW_MS * 2 + 200);
  assert.equal(s.reached, false);
  assert.equal(s.clicks.length, 1);
});
