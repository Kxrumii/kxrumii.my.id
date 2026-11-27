import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ease, samplePath, type ChoreographyProfile, type ProfileId } from '../src/showroom/camera.ts';
import { depthState, worldToCamera, cameraTransform } from '../src/showroom/cameraTransform.ts';
import { LANDSCAPE_PROFILE, PLACEHOLDER_SLUGS, PORTRAIT_PROFILE, PROFILES, profileFor } from '../src/showroom/choreography.ts';
import {
  MIN_HOLD_S,
  buildTimeline,
  holdStartOf,
  navPlan,
  placeholderSchedule,
  sceneAt,
  validateProfile,
  validateTimeline,
  type Schedule,
} from '../src/showroom/timeline.ts';

const profiles: ProfileId[] = ['landscape', 'portrait'];
const timelineFor = (id: ProfileId) => buildTimeline(PROFILES[id], placeholderSchedule(PROFILES[id]));

test('authored profiles validate against the sample works, with a valid placeholder schedule', () => {
  for (const id of profiles) {
    const profile = PROFILES[id];
    assert.deepEqual(validateTimeline(profile, placeholderSchedule(profile), PLACEHOLDER_SLUGS), [], id);
  }
});

test('landscape and portrait share cue order, segment ids, kinds, easings and durations', () => {
  const brief = (p: ChoreographyProfile) => ({
    cues: p.cues.map((c) => [c.id, c.projectSlug, c.stopId, c.outSegmentId, c.backSegmentId]),
    segments: p.segments.map((s) => [s.id, s.fromStop, s.toStop, s.kind, s.easing, s.durationS]),
  });
  assert.deepEqual(brief(LANDSCAPE_PROFILE), brief(PORTRAIT_PROFILE));
  assert.notDeepEqual(LANDSCAPE_PROFILE.stops.map((s) => s.pose), PORTRAIT_PROFILE.stops.map((s) => s.pose));
});

test('camera data and scene state carry no morph information', () => {
  for (const id of profiles) {
    for (const segment of PROFILES[id].segments) {
      assert.ok(!Object.keys(segment).some((key) => /morph/i.test(key)), segment.id);
    }
    const scene = sceneAt(timelineFor(id), 4);
    assert.ok(!Object.keys(scene).some((key) => /morph/i.test(key)));
  }
});

test('sceneAt is deterministic (bit-identical) across calls and across freshly built timelines', () => {
  for (const id of profiles) {
    const a = timelineFor(id);
    const b = timelineFor(id);
    for (let t = -3; t < a.cycleS * 2; t += 0.137) {
      assert.deepStrictEqual(sceneAt(a, t), sceneAt(a, t));
      assert.deepStrictEqual(sceneAt(a, t), sceneAt(b, t));
    }
  }
});

test('HOLD pose equals the stop pose exactly and is upright; transit ends exactly on the next stop', () => {
  for (const id of profiles) {
    const timeline = timelineFor(id);
    for (const c of timeline.cues) {
      const mid = c.holdStartS + Math.min(c.holdS, 1) / 2;
      const scene = sceneAt(timeline, mid);
      assert.equal(scene.phase, 'hold');
      assert.equal(scene.focusIndex, c.index);
      assert.deepStrictEqual(scene.camera, c.stop.pose);
      assert.equal(scene.camera.roll, 0);

      const start = sceneAt(timeline, c.transitionStartS);
      assert.equal(start.phase, 'transit');
      assert.deepStrictEqual(start.camera, c.stop.pose);

      const arrival = sceneAt(timeline, c.arrivalS);
      const target = timeline.cues[(c.index + 1) % timeline.cues.length];
      assert.equal(arrival.phase, 'hold');
      assert.equal(arrival.focusIndex, target.index);
      assert.deepStrictEqual(arrival.camera, target.stop.pose);
    }
  }
});

test('focus switches to the target at the midpoint of a transition', () => {
  const timeline = timelineFor('landscape');
  const c = timeline.cues[0];
  assert.equal(sceneAt(timeline, c.transitionStartS + c.durationS * 0.25).focusIndex, 0);
  assert.equal(sceneAt(timeline, c.transitionStartS + c.durationS * 0.75).focusIndex, 1);
});

test('the loop has no camera jump: wrap equality, no hop between neighbouring samples', () => {
  for (const id of profiles) {
    const timeline = timelineFor(id);
    assert.deepStrictEqual(sceneAt(timeline, 0), sceneAt(timeline, timeline.cycleS));
    let worst = 0;
    let previous = sceneAt(timeline, 0).camera;
    const stepS = 0.001;
    for (let t = stepS; t <= timeline.cycleS + stepS; t += stepS) {
      const pose = sceneAt(timeline, t).camera;
      worst = Math.max(worst, Math.abs(pose.x - previous.x), Math.abs(pose.y - previous.y), Math.abs(pose.z - previous.z));
      previous = pose;
    }
    // Longest authored move is a few thousand px over >= 2.4 s with cubic easing: well below 20 px per ms.
    assert.ok(worst < 20, `${id}: largest per-millisecond hop ${worst}`);
  }
});

// Synthetic schedule (test only): the last transition crosses the loop boundary.
const CROSSING: Schedule = { cycleS: 28, transitionStartS: [3, 8, 13.5, 19, 25.5] };

test('a transition may cross the loop boundary without a jump', () => {
  const timeline = buildTimeline(LANDSCAPE_PROFILE, CROSSING);
  const last = timeline.cues[4];
  assert.ok(last.arrivalS > timeline.cycleS);
  const before = sceneAt(timeline, timeline.cycleS - 1e-6);
  const after = sceneAt(timeline, 1e-6);
  assert.equal(before.phase, 'transit');
  assert.equal(after.phase, 'transit');
  assert.equal(before.windowIndex, 4);
  assert.equal(after.windowIndex, 4);
  for (const key of ['x', 'y', 'z', 'pitch', 'yaw', 'roll'] as const) {
    assert.ok(Math.abs(before.camera[key] - after.camera[key]) < 1e-2, key);
  }
  assert.equal(holdStartOf(timeline, 0), (last.arrivalS) % timeline.cycleS);
});

test('scrubbing forward and backward over the same times yields identical scenes', () => {
  const timeline = timelineFor('landscape');
  const times = Array.from({ length: 200 }, (_, i) => (i * timeline.cycleS) / 200);
  const forward = times.map((t) => sceneAt(timeline, t));
  const backward = [...times].reverse().map((t) => sceneAt(timeline, t)).reverse();
  assert.deepStrictEqual(forward, backward);
});

test('Next plans the outgoing window; Previous plans the arriving window with the reverse path', () => {
  const timeline = timelineFor('landscape');
  const next = navPlan(timeline, 1, 1);
  assert.deepEqual([next.targetIndex, next.variant, next.windowIndex], [2, 'forward', 1]);
  assert.equal(next.seekToS, timeline.cues[1].transitionStartS);

  const prev = navPlan(timeline, 2, -1);
  assert.deepEqual([prev.targetIndex, prev.variant, prev.windowIndex], [1, 'back', 0]);
  assert.equal(prev.seekToS, timeline.cues[0].transitionStartS);

  // Playing the Previous window travels stop(2) -> stop(1) with the authored reverse segment.
  const start = sceneAt(timeline, prev.seekToS, prev.variant);
  assert.equal(start.segmentId, 'seg-orbit-rise-rev');
  assert.deepStrictEqual(start.camera, timeline.cues[2].stop.pose);
  const done = sceneAt(timeline, prev.seekToS + prev.durationS, prev.variant);
  assert.equal(done.phase, 'hold');
  assert.equal(done.focusIndex, 1);
  assert.deepStrictEqual(done.camera, timeline.cues[1].stop.pose);
});

test('navigation wraps around the loop in both directions', () => {
  const timeline = timelineFor('portrait');
  const n = timeline.cues.length;
  assert.equal(navPlan(timeline, n - 1, 1).targetIndex, 0);
  const prev = navPlan(timeline, 0, -1);
  assert.equal(prev.targetIndex, n - 1);
  assert.equal(prev.windowIndex, n - 2);
  const done = sceneAt(timeline, prev.seekToS + prev.durationS, prev.variant);
  assert.equal(done.focusIndex, n - 1);
});

test('stops frame their anchors on the optical axis at the profile distance', () => {
  for (const id of profiles) {
    const profile = PROFILES[id];
    const distance = id === 'landscape' ? 1000 : 2770;
    for (const cue of profile.cues) {
      const stop = profile.stops.find((s) => s.id === cue.stopId)!;
      const anchor = profile.anchors.find((a) => a.slug === cue.projectSlug)!;
      const p = worldToCamera(stop.pose, anchor);
      assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6, `${id} ${cue.id}`);
      assert.ok(Math.abs(p.z + distance) < 1e-6, `${id} ${cue.id}`);
      assert.equal(depthState(stop.pose, anchor, profile.perspectivePx).opacity, 1);
    }
  }
});

test('depth state: behind the camera is hidden, far fog fades out, near fades in', () => {
  const pose = LANDSCAPE_PROFILE.stops[0].pose;
  const at = (z: number) => depthState(pose, { x: pose.x, y: pose.y, z }, 1200).opacity;
  assert.equal(at(pose.z + 50), 0);
  assert.equal(at(pose.z - 100), 0);
  assert.ok(at(pose.z - 450) > 0 && at(pose.z - 450) < 1);
  assert.equal(at(pose.z - 2000), 1);
  assert.equal(at(pose.z - 12000), 0);
});

test('camera transform string is stable and in the documented order', () => {
  const css = cameraTransform({ x: 1, y: -2, z: 3, pitch: 4, yaw: 5, roll: 6 }, 1200);
  assert.equal(css, 'translateZ(1200px) rotateZ(-6deg) rotateX(-4deg) rotateY(-5deg) translate3d(-1px, 2px, -3px)');
});

test('profile selection uses aspect ratio / width with hysteresis', () => {
  assert.equal(profileFor(1440, 900), 'landscape');
  assert.equal(profileFor(390, 844), 'portrait');
  assert.equal(profileFor(800, 1200), 'portrait');
  // Near the threshold the current profile sticks.
  assert.equal(profileFor(780, 1000, 'landscape'), 'landscape'); // aspect 0.78 >= 0.75
  assert.equal(profileFor(780, 1000, 'portrait'), 'portrait'); // aspect 0.78 < 0.85
  assert.equal(profileFor(900, 1000, 'portrait'), 'landscape');
  assert.equal(profileFor(700, 1000, 'landscape'), 'portrait');
});

test('validation rejects broken choreography and schedules', () => {
  const base = LANDSCAPE_PROFILE;
  const schedule = placeholderSchedule(base);
  assert.ok(validateTimeline(base, schedule, ['a', 'b']).length > 0, 'slug mismatch');

  const dupSlug: ChoreographyProfile = { ...base, cues: base.cues.map((c, i) => (i === 1 ? { ...c, projectSlug: base.cues[0].projectSlug } : c)) };
  assert.ok(validateProfile(dupSlug).some((e) => /unique/.test(e)));

  const badKeyframe: ChoreographyProfile = {
    ...base,
    segments: base.segments.map((s, i) => (i === 0 ? { ...s, keyframes: [{ at: 1.2, pose: base.stops[0].pose }] } : s)),
  };
  assert.ok(validateProfile(badKeyframe).some((e) => /keyframe/.test(e)));

  const wrongBackDuration: ChoreographyProfile = {
    ...base,
    segments: base.segments.map((s) => (s.id === 'seg-dolly-drift-rev' ? { ...s, durationS: 9 } : s)),
  };
  assert.ok(validateProfile(wrongBackDuration).some((e) => /back segment duration/.test(e)));

  const tooTight: Schedule = { cycleS: schedule.cycleS, transitionStartS: schedule.transitionStartS.map((t, i) => (i === 1 ? t - 2 : t)) };
  assert.ok(validateTimeline(base, tooTight).some((e) => /below the minimum/.test(e)));

  assert.throws(() => buildTimeline(base, tooTight), /Invalid showroom timeline/);
  assert.ok(MIN_HOLD_S > 0);
});

test('easing and path sampling hit their end points exactly', () => {
  for (const name of ['linear', 'ease-out', 'ease-in-out', 'ease-in-out-cubic'] as const) {
    assert.ok(Object.is(ease(name, 0), 0));
    assert.equal(ease(name, 1), 1);
    let last = 0;
    for (let p = 0.01; p < 1; p += 0.01) {
      const v = ease(name, p);
      assert.ok(v >= last - 1e-12, `${name} must be monotone`);
      last = v;
    }
  }
  const a = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  const b = { x: 10, y: 20, z: 30, pitch: 1, yaw: 2, roll: 3 };
  assert.deepStrictEqual(samplePath(a, undefined, b, 0), a);
  assert.deepStrictEqual(samplePath(a, undefined, b, 1), b);
  assert.deepStrictEqual(samplePath(a, undefined, b, 0.5), { x: 5, y: 10, z: 15, pitch: 0.5, yaw: 1, roll: 1.5 });
  const via = { at: 0.5, pose: { ...b, roll: 180 } };
  assert.equal(samplePath(a, [via], b, 0.5).roll, 180);
});
