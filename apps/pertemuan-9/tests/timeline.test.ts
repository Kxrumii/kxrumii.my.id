import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cubicBezier, ease, samplePath, sameAngle, type ChoreographyProfile, type ProfileId } from '../src/showroom/camera.ts';
import { cameraTransform, depthState, worldToAnchor, worldToCamera } from '../src/showroom/cameraTransform.ts';
import { LANDSCAPE_PROFILE, PLACEHOLDER_SLUGS, PORTRAIT_PROFILE, PROFILES, profileFor } from '../src/showroom/choreography.ts';
import { pathPenetrations } from '../src/showroom/clearance.ts';
import { BEAT_S, DEFAULT_TUNE, HOLD_S, TRANSIT_S, alignToPeriod, masterCycleS } from '../src/showroom/tempo.ts';
import {
  MIN_HOLD_S,
  buildTimeline,
  fixedSchedule,
  holdStartOf,
  navPlan,
  sceneAt,
  validateProfile,
  validateTimeline,
  type Schedule,
} from '../src/showroom/timeline.ts';

const profiles: ProfileId[] = ['landscape', 'portrait'];
const timelineFor = (id: ProfileId) => buildTimeline(PROFILES[id], fixedSchedule(PROFILES[id]));
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

/* ---------- tempo (owner decision: 2 beats transit, 6 beats hold) ---------- */

test('tempo: transitions last 2 beats and holds 6 beats of the On Sight beat', () => {
  assert.deepEqual([DEFAULT_TUNE.transitBeats, DEFAULT_TUNE.holdBeats], [2, 6]);
  near(BEAT_S, 27.513 / 32);
  near(TRANSIT_S, 2 * BEAT_S);
  near(HOLD_S, 6 * BEAT_S);
  const timeline = timelineFor('landscape');
  near(timeline.cycleS, 5 * 8 * BEAT_S, 1e-9);
  timeline.cues.forEach((c, i) => {
    near(c.transitionStartS, i * 8 * BEAT_S, 1e-9);
    near(c.holdS, HOLD_S, 1e-9);
    near(c.durationS, TRANSIT_S);
  });
});

test('the master timeline is the LCM of the camera cycle and the 32-beat music loop', () => {
  const camera = 40 * BEAT_S;
  near(masterCycleS(camera), 160 * BEAT_S, 1e-9);
  near(masterCycleS(32 * BEAT_S), 32 * BEAT_S, 1e-9);
  near(masterCycleS(8 * BEAT_S), 32 * BEAT_S, 1e-9);
  // A cycle that is not a whole number of beats falls back to itself.
  assert.equal(masterCycleS(10.1234), 10.1234);
});

test('alignToPeriod picks the occurrence of a camera time nearest to the current master time', () => {
  const period = 34;
  const master = 136;
  assert.equal(alignToPeriod(70, 5, period, master), 73); // same period (68..102)
  assert.equal(alignToPeriod(70, 30, period, master), 64); // previous period is closer
  assert.equal(alignToPeriod(135, 2, period, master), 2); // wraps round the master cycle (138 mod 136)
});

/* ---------- authored profiles ---------- */

test('authored profiles validate against the sample works, with the fixed schedule', () => {
  for (const id of profiles) {
    const profile = PROFILES[id];
    assert.deepEqual(validateTimeline(profile, fixedSchedule(profile), PLACEHOLDER_SLUGS), [], id);
  }
});

test('landscape and portrait share cue order, segment ids, kinds, rolls, easings and durations', () => {
  const brief = (p: ChoreographyProfile) => ({
    cues: p.cues.map((c) => [c.id, c.projectSlug, c.stopId, c.outSegmentId, c.backSegmentId]),
    segments: p.segments.map((s) => [s.id, s.fromStop, s.toStop, s.kind, s.easing, s.durationS, s.rollTurn]),
  });
  assert.deepEqual(brief(LANDSCAPE_PROFILE), brief(PORTRAIT_PROFILE));
  assert.notDeepEqual(LANDSCAPE_PROFILE.stops.map((s) => s.pose), PORTRAIT_PROFILE.stops.map((s) => s.pose));
});

test('owner choreography: roll +10, +90, +6, +180, then +74 back to a full turn; holds keep the work upright', () => {
  for (const id of profiles) {
    const profile = PROFILES[id];
    const turns = profile.cues.map((c) => profile.segments.find((s) => s.id === c.outSegmentId)!.rollTurn);
    assert.deepEqual(turns, [10, 90, 6, 180, 74]);
    assert.deepEqual(profile.anchors.map((a) => a.roll), [0, 10, 100, 106, 286]);
    for (const cue of profile.cues) {
      const stop = profile.stops.find((s) => s.id === cue.stopId)!;
      const anchor = profile.anchors.find((a) => a.slug === cue.projectSlug)!;
      assert.ok(sameAngle(stop.pose.roll, anchor.roll), `${id} ${cue.id}`);
    }
    // Moves: 1->2 zoom in, 2->3 zoom out, 3->4 up (and slightly in), 4->5 in and down.
    const cam = profile.stops.map((s) => s.pose);
    assert.ok(cam[1].z < cam[0].z, '1->2 zooms in');
    assert.ok(cam[2].z > cam[1].z, '2->3 zooms out');
    assert.ok(cam[3].y < cam[2].y && cam[3].z < cam[2].z, '3->4 goes up and slightly in');
    assert.ok(cam[4].y > cam[3].y && cam[4].z < cam[3].z, '4->5 goes in and down');
  }
});

test('the camera never passes through a work (or too close to it), in both profiles and all segments incl. reverse', () => {
  for (const id of profiles) assert.deepEqual(pathPenetrations(PROFILES[id]), [], id);
});

test('the clearance check does catch a camera path that goes through a work', () => {
  const base = LANDSCAPE_PROFILE;
  // Put work 2 straight behind work 1 and remove the detour: the push-in now goes through work 1.
  const stops = base.stops.map((s, i) => (i === 1 ? { ...s, pose: { ...s.pose, x: 0, y: 0 } } : s));
  const anchors = base.anchors.map((a, i) => (i === 1 ? { ...a, x: 0, y: 0 } : a));
  const segments = base.segments.map((s) => (s.id === 'seg-push-tilt' ? { ...s, keyframes: [] } : s));
  const found = pathPenetrations({ ...base, stops, anchors, segments });
  assert.ok(found.some((p) => p.segmentId === 'seg-push-tilt' && p.anchorSlug === 'sample-work-01'), JSON.stringify(found));
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

test('HOLD pose equals the stop pose exactly; transit ends exactly on the next stop', () => {
  for (const id of profiles) {
    const timeline = timelineFor(id);
    for (const c of timeline.cues) {
      const mid = c.holdStartS + Math.min(c.holdS, 1) / 2;
      const scene = sceneAt(timeline, mid);
      assert.equal(scene.phase, 'hold');
      assert.equal(scene.focusIndex, c.index);
      assert.deepStrictEqual(scene.camera, c.stop.pose);

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

test('the return move keeps turning the same way (+74) instead of spinning back', () => {
  const timeline = timelineFor('landscape');
  const last = timeline.cues[4];
  const mid = sceneAt(timeline, last.transitionStartS + last.durationS * 0.5).camera.roll;
  assert.ok(mid > 286 && mid < 360, `mid-turn roll ${mid}`);
});

test('focus switches to the target at the midpoint of a transition', () => {
  const timeline = timelineFor('landscape');
  const c = timeline.cues[0];
  assert.equal(sceneAt(timeline, c.transitionStartS + c.durationS * 0.25).focusIndex, 0);
  assert.equal(sceneAt(timeline, c.transitionStartS + c.durationS * 0.75).focusIndex, 1);
});

test('the loop has no camera jump: wrap equality, bounded movement between neighbouring samples', () => {
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
    // Longest move (portrait room) over 1.72 s with the transit curve: well below 40 px per ms.
    assert.ok(worst < 40, `${id}: largest per-millisecond hop ${worst}`);
  }
});

// Synthetic schedule (test only): the last transition crosses the loop boundary.
const CROSSING: Schedule = { cycleS: 28, transitionStartS: [2.5, 6.5, 12, 17.5, 27] };

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
    assert.ok(Math.abs(before.camera[key] - after.camera[key]) < 0.05, key);
  }
  assert.equal(holdStartOf(timeline, 0), last.arrivalS % timeline.cycleS);
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

  const start = sceneAt(timeline, prev.seekToS, prev.variant);
  assert.equal(start.segmentId, 'seg-pull-quarter-rev');
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

test('worldToAnchor inverts the anchor placement (yaw and roll)', () => {
  const anchor = { x: 10, y: -20, z: 30, yaw: 25, roll: 100 };
  const local = worldToAnchor(anchor, { x: 10, y: -20, z: 30 });
  near(local.x, 0, 1e-9);
  near(local.z, 0, 1e-9);
  // A point straight in front of the work's face lies on its local +z axis.
  const yaw = (25 * Math.PI) / 180;
  const front = worldToAnchor(anchor, { x: 10 + 500 * Math.sin(yaw), y: -20, z: 30 + 500 * Math.cos(yaw) });
  near(front.x, 0, 1e-6);
  near(front.y, 0, 1e-6);
  near(front.z, 500, 1e-6);
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
  assert.equal(profileFor(780, 1000, 'landscape'), 'landscape');
  assert.equal(profileFor(780, 1000, 'portrait'), 'portrait');
  assert.equal(profileFor(900, 1000, 'portrait'), 'landscape');
  assert.equal(profileFor(700, 1000, 'landscape'), 'portrait');
});

test('validation rejects broken choreography and schedules', () => {
  const base = LANDSCAPE_PROFILE;
  const schedule = fixedSchedule(base);
  assert.ok(validateTimeline(base, schedule, ['a', 'b']).length > 0, 'slug mismatch');

  const dupSlug: ChoreographyProfile = { ...base, cues: base.cues.map((c, i) => (i === 1 ? { ...c, projectSlug: base.cues[0].projectSlug } : c)) };
  assert.ok(validateProfile(dupSlug).some((e) => /unique/.test(e)));

  const badKeyframe: ChoreographyProfile = {
    ...base,
    segments: base.segments.map((s, i) => (i === 0 ? { ...s, keyframes: [{ at: 1.2, position: { x: 0, y: 0, z: 0 } }] } : s)),
  };
  assert.ok(validateProfile(badKeyframe).some((e) => /keyframe/.test(e)));

  const wrongBackDuration: ChoreographyProfile = {
    ...base,
    segments: base.segments.map((s) => (s.id === 'seg-push-tilt-rev' ? { ...s, durationS: 9 } : s)),
  };
  assert.ok(validateProfile(wrongBackDuration).some((e) => /back segment duration/.test(e)));

  const wrongTurn: ChoreographyProfile = { ...base, segments: base.segments.map((s) => (s.id === 'seg-rise' ? { ...s, rollTurn: 7 } : s)) };
  const turnErrors = validateProfile(wrongTurn);
  assert.ok(turnErrors.some((e) => /rollTurn must land/.test(e)), turnErrors.join(' | '));

  const tilted: ChoreographyProfile = { ...base, anchors: base.anchors.map((a, i) => (i === 2 ? { ...a, roll: 0 } : a)) };
  assert.ok(validateProfile(tilted).some((e) => /upright/.test(e)));

  const tooTight: Schedule = { cycleS: schedule.cycleS, transitionStartS: schedule.transitionStartS.map((t, i) => (i === 1 ? t - 5 : t)) };
  assert.ok(validateTimeline(base, tooTight).some((e) => /below the minimum/.test(e)));
  assert.throws(() => buildTimeline(base, tooTight), /Invalid showroom timeline/);
  assert.ok(MIN_HOLD_S > 0);
});

test('easing: named curves and cubic-bezier hit their end points exactly and are monotone', () => {
  for (const easing of ['linear', 'ease-out', 'ease-in-out', 'ease-in-out-cubic', [0.7, 0, 0.3, 1], [0.25, 0.1, 0.25, 1]] as const) {
    assert.ok(Object.is(ease(easing, 0), 0));
    assert.equal(ease(easing, 1), 1);
    let last = 0;
    for (let p = 0.01; p < 1; p += 0.01) {
      const v = ease(easing, p);
      assert.ok(v >= last - 1e-9, `${JSON.stringify(easing)} must be monotone`);
      last = v;
    }
  }
  // cubic-bezier(0, 0, 1, 1) is linear; the transit curve is symmetric around the middle.
  near(cubicBezier(0, 0, 1, 1, 0.37), 0.37, 1e-6);
  near(cubicBezier(0.7, 0, 0.3, 1, 0.5), 0.5, 1e-6);
  near(cubicBezier(0.7, 0, 0.3, 1, 0.2) + cubicBezier(0.7, 0, 0.3, 1, 0.8), 1, 1e-6);
});

test('path sampling: positions through keyframes, angles straight, end points exact', () => {
  const a = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  const b = { x: 10, y: 20, z: 30, pitch: 1, yaw: 2, roll: 90 };
  assert.deepStrictEqual(samplePath(a, undefined, b, 0), a);
  assert.deepStrictEqual(samplePath(a, undefined, b, 1), b);
  assert.deepStrictEqual(samplePath(a, undefined, b, 0.5), { x: 5, y: 10, z: 15, pitch: 0.5, yaw: 1, roll: 45 });
  const via = samplePath(a, [{ at: 0.5, position: { x: 100, y: 0, z: 0 } }], b, 0.5);
  assert.equal(via.x, 100);
  assert.equal(via.roll, 45);
});
