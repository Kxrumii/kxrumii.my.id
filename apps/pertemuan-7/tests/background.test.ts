import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addPointer, ambientScatter, charFor, createWake, speedFactor, stepWake, WAKE_MAX_CELLS, WAKE_RAMP } from '../src/background/asciiWake.ts';
import {
  createShootingStar,
  createStars,
  nextShootingDelayMs,
  regenerateStars,
  seededRng,
  STAR_COLORS,
  STAR_CONFIG,
  starCount,
  stepShootingStars,
  stepTwinkle,
} from '../src/background/pixelStars.ts';
import { liveRipples, rippleAlpha, rippleBoost, RIPPLE_LIFE_S, RIPPLE_SPEED } from '../src/background/ripple.ts';

test('star count follows the original density and stars sit on the 5 px pixel grid', () => {
  assert.equal(starCount(1440, 900), Math.floor(1440 * 900 * STAR_CONFIG.density));
  const stars = createStars(1440, 900, seededRng(1));
  assert.equal(stars.length, starCount(1440, 900));
  for (const star of stars) {
    assert.equal(star.x % STAR_CONFIG.pixelSize, 0);
    assert.equal(star.y % STAR_CONFIG.pixelSize, 0);
    assert.ok(star.x >= 0 && star.x < 1440 && star.y >= 0 && star.y < 900);
    assert.ok((STAR_COLORS as readonly string[]).includes(star.color));
    assert.ok(star.baseOpacity >= 0.5 && star.baseOpacity <= 1);
  }
});

test('the same seed gives the same sky', () => {
  assert.deepEqual(createStars(800, 600, seededRng(7)), createStars(800, 600, seededRng(7)));
});

test('regeneration replaces 15 % of the stars (at least one)', () => {
  const stars = createStars(1440, 900, seededRng(2));
  const replaced = regenerateStars(stars, 1440, 900, seededRng(3));
  assert.equal(replaced.length, Math.max(1, Math.floor(stars.length * STAR_CONFIG.regenerateFraction)));
  assert.deepEqual(regenerateStars([], 10, 10, seededRng(3)), []);
});

test('twinkling steps between two brightness levels', () => {
  const [star] = createStars(1000, 1000, seededRng(4)).filter((s) => s.twinkle);
  const levels = new Set<number>();
  for (let i = 0; i < 200; i += 1) {
    stepTwinkle(star);
    levels.add(Number(star.currentOpacity.toFixed(6)));
  }
  assert.deepEqual([...levels].sort(), [Number((star.baseOpacity * 0.3).toFixed(6)), Number(star.baseOpacity.toFixed(6))].sort());
});

test('shooting stars start on the top edge, leave a fading trail and are dropped off-screen', () => {
  const rng = seededRng(5);
  let list = [createShootingStar(800, rng)];
  assert.equal(list[0].y, 0);
  assert.ok(list[0].angle >= 45 && list[0].angle <= 135);
  let sawTrail = false;
  for (let i = 0; i < 400 && list.length; i += 1) {
    list = stepShootingStars(list, 800, 600);
    if (list[0]?.trail.length) sawTrail = true;
    for (const point of list[0]?.trail ?? []) assert.ok(point.opacity > 0 && point.opacity <= 1);
  }
  assert.ok(sawTrail);
  assert.equal(list.length, 0);
  const delay = nextShootingDelayMs(seededRng(6));
  assert.ok(delay >= STAR_CONFIG.shootingMinDelayMs && delay <= STAR_CONFIG.shootingMaxDelayMs);
});

test('the wake grows with speed, is capped, and decays away', () => {
  assert.equal(speedFactor(0), 0);
  assert.equal(speedFactor(100), 1);
  const wake = createWake();
  assert.equal(addPointer(wake, 0, 0, 0), 0, 'first sample has no speed');
  const slow = addPointer(wake, 10, 0, 20);
  const fast = addPointer(wake, 210, 0, 40);
  assert.ok(fast > slow);
  for (let i = 0; i < 300; i += 1) addPointer(wake, (i % 90) * 16, Math.floor(i / 90) * 16, 40 + i * 4);
  assert.ok(wake.cells.size <= WAKE_MAX_CELLS);
  stepWake(wake, 5);
  assert.equal(wake.cells.size, 0);
});

test('a long pause does not draw a line across the screen', () => {
  const wake = createWake();
  addPointer(wake, 0, 0, 0);
  assert.equal(addPointer(wake, 900, 500, 5000), 0);
  assert.equal(wake.cells.size, 0);
});

test('characters thin out as energy decays; the resting scatter is sparse and dim', () => {
  assert.equal(charFor(1), WAKE_RAMP[WAKE_RAMP.length - 1]);
  assert.equal(charFor(0), WAKE_RAMP[0]);
  const scatter = ambientScatter(1440, 900, seededRng(8));
  const cells = Math.ceil(1440 / 16) * Math.ceil(900 / 16);
  assert.ok(scatter.length > 0 && scatter.length < cells * 0.06);
  for (const glyph of scatter) assert.ok(glyph.alpha < 0.2);
});

test('ripples expand, fade, light up stars on the ring and expire', () => {
  const ripple = { x: 0, y: 0, bornS: 10 };
  assert.equal(rippleAlpha(ripple, 10), 1);
  assert.equal(rippleAlpha(ripple, 10 + RIPPLE_LIFE_S), 0);
  const onRing = rippleBoost([ripple], RIPPLE_SPEED * 0.5, 0, 10.5);
  const offRing = rippleBoost([ripple], 10, 0, 10.5);
  assert.ok(onRing > 0.2);
  assert.equal(offRing, 0);
  assert.deepEqual(liveRipples([ripple], 10 + RIPPLE_LIFE_S + 0.01), []);
});
