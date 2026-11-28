import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARRIVAL_COOLDOWN_MS, EDGE_SETTLE_MS, edgeIntent, edgeOf, edgeReady } from '../src/utils/nextProgress.ts';

test('edges of the page are detected, including a page that fits the viewport', () => {
  assert.equal(edgeOf(0, 800, 3000), 'top');
  assert.equal(edgeOf(2200, 800, 3000), 'bottom');
  assert.equal(edgeOf(1000, 800, 3000), null);
  assert.equal(edgeOf(0, 800, 700), 'both');
});

test('scrolling down at the bottom means next, up at the top means previous, nothing in between', () => {
  assert.equal(edgeIntent('bottom', 40), 'next');
  assert.equal(edgeIntent('bottom', -40), null);
  assert.equal(edgeIntent('top', -40), 'prev');
  assert.equal(edgeIntent('top', 40), null);
  assert.equal(edgeIntent('both', 40), 'next');
  assert.equal(edgeIntent('both', -40), 'prev');
  assert.equal(edgeIntent(null, 40), null);
});

test('edge input waits for the arrival cooldown and for the viewport to settle at the edge', () => {
  const arrived = 1000;
  const atEdge = 1000;
  assert.equal(edgeReady(arrived + ARRIVAL_COOLDOWN_MS - 1, arrived, atEdge), false, 'still cooling down');
  assert.equal(edgeReady(arrived + ARRIVAL_COOLDOWN_MS, arrived, atEdge), true);
  const reachedLate = arrived + 5000;
  assert.equal(edgeReady(reachedLate + EDGE_SETTLE_MS - 1, arrived, reachedLate), false, 'just reached the edge');
  assert.equal(edgeReady(reachedLate + EDGE_SETTLE_MS, arrived, reachedLate), true);
  assert.equal(edgeReady(99999, arrived, null), false, 'not at an edge');
});
