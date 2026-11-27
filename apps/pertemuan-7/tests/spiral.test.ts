import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeSlot,
  activeWorkIndex,
  cardPose,
  MIN_SLOTS,
  nearestPositionFor,
  slotCount,
  slotOffset,
  workIndexForSlot,
} from '../src/spiral/geometry.ts';

const geometry = { radius: 400, rise: 120 };

test('slot count fills at least one full turn with whole repetitions of the list', () => {
  assert.equal(slotCount(0), 0);
  assert.equal(slotCount(1), 1);
  assert.equal(slotCount(2), 2);
  for (const n of [3, 4, 5, 6, 7, 12, 13, 20]) {
    const slots = slotCount(n);
    assert.ok(slots >= MIN_SLOTS || slots === n, `n=${n}`);
    assert.equal(slots % n, 0, `n=${n} repeats whole lists`);
    assert.ok(slots >= n);
  }
});

test('slots map onto works in the original order', () => {
  const n = 5;
  const order = Array.from({ length: slotCount(n) }, (_, slot) => workIndexForSlot(slot, n));
  assert.deepEqual(order.slice(0, 7), [0, 1, 2, 3, 4, 0, 1]);
  assert.equal(workIndexForSlot(-1, n), 4);
});

test('offsets wrap into half a turn when looping and stay linear otherwise', () => {
  assert.equal(slotOffset(11, 0, 12, true), -1);
  assert.equal(slotOffset(1, 11.5, 12, true), 1.5);
  assert.equal(slotOffset(1, 0, 2, false), 1);
  assert.equal(slotOffset(3, Number.NaN, 12, true), 3);
});

test('the active slot and work follow the rounded position, including negative positions', () => {
  assert.equal(activeSlot(0.4, 12), 0);
  assert.equal(activeSlot(-0.6, 12), 11);
  assert.equal(activeWorkIndex(13, 6), 1);
  assert.equal(activeWorkIndex(-1, 6), 5);
  assert.equal(activeSlot(1, 0), -1);
});

test('the front card faces the camera, is opaque and interactive; the back recedes', () => {
  const slots = slotCount(6);
  const front = cardPose(0, 0, slots, true, geometry);
  assert.equal(front.facing, 1);
  assert.equal(front.opacity, 1);
  assert.ok(front.interactive);
  assert.match(front.transform, /rotateY\(0\.000deg\)/);
  const back = cardPose(slots / 2 - 0, 0, slots, true, geometry);
  assert.ok(back.facing < 0);
  assert.ok(back.opacity < 0.5);
  assert.equal(back.interactive, false);
});

test('poses are always finite, whatever the input', () => {
  for (const p of [0, 0.5, -3.25, 1e6, Number.NaN, Number.POSITIVE_INFINITY]) {
    const pose = cardPose(3, p, 12, true, geometry);
    assert.ok(Number.isFinite(pose.opacity));
    assert.doesNotMatch(pose.transform, /NaN|Infinity/);
  }
});

test('nearest position takes the shortest way round to a work', () => {
  const n = 6; // 12 slots, every work appears twice
  assert.equal(nearestPositionFor(1, 0, n), 1);
  assert.equal(nearestPositionFor(5, 0, n), -1);
  assert.equal(nearestPositionFor(0, 10.6, n), 12);
  assert.equal(workIndexForSlot(nearestPositionFor(4, 37.2, n), n), 4);
  // No loop: clamp into the list.
  assert.equal(nearestPositionFor(5, 0, 2), 1);
});
