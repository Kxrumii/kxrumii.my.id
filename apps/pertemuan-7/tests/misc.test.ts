import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANDSCAPE_PROFILE, PORTRAIT_PROFILE } from '../src/showroom/choreography.ts';
import { FRAGMENT_SEED, MAX_DRIFT_FRAGMENTS, generateFragments, mulberry32 } from '../src/showroom/fragments.ts';
import {
  DOM_DELTA_LINE,
  DOM_DELTA_PAGE,
  DOM_DELTA_PIXEL,
  MAX_WHEEL_DELTA_PX,
  normalizeWheelDelta,
  wheelToTimelineSeconds,
} from '../src/showroom/wheel.ts';
import {
  MORPH_PRESETS,
  MORPH_SPECS,
  interpolateShape,
  shapeDistance,
  perforationAt,
  perforationKeyframes,
  toClipPath,
} from '../src/motion/morphShapes.ts';

/* ---------- film fragments ---------- */

const fnv1a = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};

test('fragments are deterministic with stable ids, bounds and depth layers', () => {
  for (const profile of [LANDSCAPE_PROFILE, PORTRAIT_PROFILE]) {
    const a = generateFragments(profile.fragmentCount, profile.fragmentBounds);
    const b = generateFragments(profile.fragmentCount, profile.fragmentBounds);
    assert.deepStrictEqual(a, b);
    assert.equal(a.length, profile.fragmentCount);
    assert.deepEqual(a.map((f) => f.id), Array.from({ length: a.length }, (_, i) => `frag-${String(i + 1).padStart(3, '0')}`));
    assert.equal(new Set(a.map((f) => f.id)).size, a.length);
    for (const f of a) {
      assert.ok(f.x >= profile.fragmentBounds.x[0] && f.x <= profile.fragmentBounds.x[1]);
      assert.ok(f.y >= profile.fragmentBounds.y[0] && f.y <= profile.fragmentBounds.y[1]);
      assert.ok(f.z >= profile.fragmentBounds.z[0] && f.z <= profile.fragmentBounds.z[1]);
      assert.ok([0, 1, 2].includes(f.depthLayer));
      assert.ok(f.w > 0 && f.h > 0 && f.w <= 3 * 96);
    }
    assert.equal(a.filter((f) => f.drift).length, Math.min(a.length, MAX_DRIFT_FRAGMENTS));
  }
  assert.notDeepStrictEqual(generateFragments(5, LANDSCAPE_PROFILE.fragmentBounds), generateFragments(5, LANDSCAPE_PROFILE.fragmentBounds, FRAGMENT_SEED + 1));
});

test('fragment output matches the golden checksum (ids, positions, rotations and depth must not drift)', () => {
  const landscape = fnv1a(JSON.stringify(generateFragments(LANDSCAPE_PROFILE.fragmentCount, LANDSCAPE_PROFILE.fragmentBounds)));
  const portrait = fnv1a(JSON.stringify(generateFragments(PORTRAIT_PROFILE.fragmentCount, PORTRAIT_PROFILE.fragmentBounds)));
  assert.deepEqual([landscape, portrait], [GOLDEN.landscape, GOLDEN.portrait]);
});

test('mulberry32 is reproducible', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

// Regression anchor recorded from the generator's first run (not an independent oracle): any change to the generator,
// seed, draw order or profile bounds must update this deliberately.
const GOLDEN = { landscape: 2541160098, portrait: 3858317286 };

/* ---------- wheel ---------- */

test('wheel deltas are normalised by deltaMode, dominant axis, and clamped', () => {
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: 5, deltaMode: DOM_DELTA_PIXEL }, 800), 5);
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: -5, deltaMode: DOM_DELTA_PIXEL }, 800), -5);
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: DOM_DELTA_LINE }, 800), 54);
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: 1, deltaMode: DOM_DELTA_PAGE }, 800), MAX_WHEEL_DELTA_PX);
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: 5000, deltaMode: DOM_DELTA_PIXEL }, 800), MAX_WHEEL_DELTA_PX);
  assert.equal(normalizeWheelDelta({ deltaX: 0, deltaY: -5000, deltaMode: DOM_DELTA_PIXEL }, 800), -MAX_WHEEL_DELTA_PX);
  assert.equal(normalizeWheelDelta({ deltaX: 40, deltaY: 10, deltaMode: DOM_DELTA_PIXEL }, 800), 40);
  assert.equal(normalizeWheelDelta({ deltaX: Number.NaN, deltaY: Number.NaN, deltaMode: DOM_DELTA_PIXEL }, 800), 0);
});

test('small trackpad deltas stay small (continuous scrub, not one step per event)', () => {
  assert.ok(Math.abs(wheelToTimelineSeconds(1)) < 0.01);
  assert.equal(wheelToTimelineSeconds(0), 0);
  assert.ok(Math.abs(wheelToTimelineSeconds(MAX_WHEEL_DELTA_PX) - 0.48) < 1e-9);
  assert.ok(wheelToTimelineSeconds(-10) < 0);
});

/* ---------- shape morph (pure logic) ---------- */

test('morph presets belong to one inset-rectangle family and render as clip-path inset()', () => {
  assert.equal(toClipPath(MORPH_PRESETS.frame), 'inset(0% 0% 0% 0% round 4px)');
  assert.equal(toClipPath(MORPH_PRESETS.hover), 'inset(1.5% 1.5% 1.5% 1.5% round 10px)');
  assert.equal(toClipPath(MORPH_PRESETS.fragment), 'inset(0% 22% 0% 22% round 2px)');
  assert.equal(toClipPath(MORPH_PRESETS.slit), 'inset(0% 49% 0% 49% round 2px)');
  for (const shape of Object.values(MORPH_PRESETS)) assert.match(toClipPath(shape), /^inset\(/);
});

test('interpolateShape returns the exact end shapes and is linear in between', () => {
  const { frame, hover } = MORPH_PRESETS;
  assert.strictEqual(interpolateShape(frame, hover, 0), frame);
  assert.strictEqual(interpolateShape(frame, hover, 1), hover);
  const half = interpolateShape(frame, hover, 0.5);
  assert.deepEqual(half.inset, [0.75, 0.75, 0.75, 0.75]);
  assert.equal(half.radiusPx, 7);
  let last = -1;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const inset = interpolateShape(frame, hover, p).inset[0];
    assert.ok(inset >= last);
    last = inset;
  }
});

test('shapeDistance is zero for equal shapes and grows with the difference', () => {
  const { frame, hover, slit } = MORPH_PRESETS;
  assert.equal(shapeDistance(frame, frame), 0);
  assert.ok(shapeDistance(frame, hover) > 0);
  assert.ok(shapeDistance(frame, slit) > shapeDistance(frame, hover));
  assert.equal(shapeDistance(frame, hover), shapeDistance(hover, frame));
});

test('the perforation overlay rises late and falls early, independent of the clip-path', () => {
  assert.equal(perforationAt(0, 1, 0.5), 0);
  assert.equal(perforationAt(0, 1, 0.7), 0);
  assert.ok(perforationAt(0, 1, 0.85) > 0 && perforationAt(0, 1, 0.85) < 1);
  assert.equal(perforationAt(0, 1, 1), 1);
  assert.equal(perforationAt(1, 0, 0.3), 0);
  assert.ok(perforationAt(1, 0, 0.15) > 0 && perforationAt(1, 0, 0.15) < 1);
  for (const [from, to] of [[0, 1], [1, 0], [0.6, 0], [0, 0.6], [0.4, 0.4]] as const) {
    const frames = perforationKeyframes(from, to);
    assert.equal(frames[0].offset, 0);
    assert.equal(frames[frames.length - 1].offset, 1);
    assert.equal(frames[0].opacity, from);
    assert.equal(frames[frames.length - 1].opacity, to);
    frames.forEach((f, i) => i > 0 && assert.ok(f.offset > frames[i - 1].offset));
  }
});

test('morph specs cover hover/detail/about only and never reference the camera', () => {
  assert.deepEqual(Object.keys(MORPH_SPECS).sort(), ['about-close', 'about-open', 'detail-close', 'detail-open', 'hover-enter', 'hover-leave']);
  for (const [key, spec] of Object.entries(MORPH_SPECS)) {
    assert.ok(['hover', 'detail', 'about'].includes(spec.context), key);
    assert.ok(spec.from in MORPH_PRESETS && spec.to in MORPH_PRESETS, key);
    assert.ok(spec.durationMs > 0);
    assert.ok(!/camera|segment|transit/i.test(JSON.stringify(spec)), key);
  }
  assert.ok(MORPH_SPECS['about-open'].durationMs <= 160, 'about-open must fit the bridge depth exit');
  assert.equal(MORPH_SPECS['detail-open'].durationMs, 500);
});
