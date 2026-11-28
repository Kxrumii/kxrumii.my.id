import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTimestamp } from '../tools/timestamp.mjs';

test('timestamps parse as seconds, minutes:seconds or hours:minutes:seconds', () => {
  assert.equal(parseTimestamp('75'), 75);
  assert.equal(parseTimestamp('12.5'), 12.5);
  assert.equal(parseTimestamp('1:15'), 75);
  assert.equal(parseTimestamp('0:12.5'), 12.5);
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp(' 2:40 '), 160);
  assert.equal(parseTimestamp(8), 8);
});

test('malformed timestamps fail loudly instead of grabbing the wrong frame', () => {
  for (const bad of ['', 'abc', '1:', ':30', '1:75', '1:60:00', '-3', '1,5']) {
    assert.throws(() => parseTimestamp(bad), /invalid timestamp/, bad);
  }
  assert.throws(() => parseTimestamp(-1), /invalid timestamp/);
});
