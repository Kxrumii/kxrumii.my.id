import assert from 'node:assert/strict';
import { test } from 'node:test';
import { equalPowerCurve, planLoopSegments } from '../src/audio/loopSchedule.ts';
import { ACTIVE_TRACK_ID, TRACKS, fileTimeAt, validateTrack, type MusicTrackConfig } from '../src/audio/tracks.ts';
import { LANDSCAPE_PROFILE, PORTRAIT_PROFILE, TRANSIT_S } from '../src/showroom/choreography.ts';
import { accentAlignment, validateAccentMap, type MusicAccentMap } from '../src/showroom/musicAccents.ts';
import { HOLD_S, buildTimeline, cameraSchedule, fixedSchedule } from '../src/showroom/timeline.ts';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const timeline = buildTimeline(LANDSCAPE_PROFILE, fixedSchedule(LANDSCAPE_PROFILE));
const CYCLE = timeline.cycleS;

/* ---------- camera schedule (authoritative) ---------- */

test('owner decision: every hold and every transition has the same length; the cycle stays 27.5 s', () => {
  for (const profile of [LANDSCAPE_PROFILE, PORTRAIT_PROFILE]) {
    for (const segment of profile.segments) assert.equal(segment.durationS, TRANSIT_S, segment.id);
  }
  const schedule = cameraSchedule(timeline);
  assert.equal(schedule.length, 5);
  for (const entry of schedule) {
    near(entry.holdS, HOLD_S);
    assert.equal(entry.transitionS, TRANSIT_S);
  }
  near(CYCLE, 27.5);
  assert.deepEqual(schedule.map((e) => e.transitionStartS), [0, 5.5, 11, 16.5, 22]);
  assert.deepEqual(schedule.map((e) => `${e.fromSlug}>${e.toSlug}`).slice(-1), ['sample-work-05>sample-work-01']);
});

test('cameraSchedule is a read-only view of the timeline', () => {
  const schedule = cameraSchedule(timeline);
  timeline.cues.forEach((c, i) => {
    assert.equal(schedule[i].cueId, c.cue.id);
    assert.equal(schedule[i].transitionStartS, c.transitionStartS);
    assert.equal(schedule[i].transitionS, c.durationS);
  });
});

/* ---------- track registry ---------- */

test('both candidate tracks are registered and their (provisional) loops are exactly one camera cycle long', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['on-sight', 'shelter-piano']);
  assert.ok(ACTIVE_TRACK_ID in TRACKS);
  for (const track of Object.values(TRACKS)) {
    assert.deepEqual(validateTrack(track, CYCLE), [], track.id);
    assert.ok(track.provisional, `${track.id} loop points still await the owner's listening check`);
  }
});

test('outside a dev build no track has a URL (licensed audio is never referenced by production code)', () => {
  for (const track of Object.values(TRACKS)) assert.equal(track.src, null, track.id);
});

test('track validation rejects loops that do not match the cycle or lack crossfade margins', () => {
  const base: MusicTrackConfig = { ...TRACKS['on-sight'] };
  assert.ok(validateTrack({ ...base, loopOutS: (base.loopInS ?? 0) + CYCLE + 0.01 }, CYCLE).some((e) => /must equal the camera cycle/.test(e)));
  assert.ok(validateTrack({ ...base, loopInS: null, loopOutS: null }, CYCLE).some((e) => /not set/.test(e)));
  assert.ok(validateTrack({ ...base, loopInS: 0.5, loopOutS: 0.5 + CYCLE, crossfadeMs: 2000 }, CYCLE).some((e) => /before it/.test(e)));
  assert.ok(validateTrack({ ...base, loopInS: base.durationS - CYCLE, loopOutS: base.durationS, crossfadeMs: 1000 }, CYCLE).some((e) => /after it/.test(e)));
  assert.ok(validateTrack({ ...base, crossfadeMs: CYCLE * 600 }, CYCLE).some((e) => /half a cycle/.test(e)));
  // One sample of tolerance at 48 kHz, no more.
  assert.deepEqual(validateTrack({ ...base, loopOutS: (base.loopInS ?? 0) + CYCLE + 1 / 96000 }, CYCLE), []);
});

test('timeline position maps to file time from loop-in', () => {
  const track = TRACKS['on-sight'];
  near(fileTimeAt(track, 0), track.loopInS ?? NaN);
  near(fileTimeAt(track, 10), (track.loopInS ?? NaN) + 10);
});

/* ---------- crossfade loop scheduling ---------- */

test('crossfade plan: segments overlap by exactly the crossfade, centred on every loop boundary, with no gap', () => {
  const cycleS = 27.5;
  const crossfadeS = 2;
  const segs = planLoopSegments({ whenS: 100, offsetS: 3, cycleS, crossfadeS, untilS: 100 + 3 * cycleS });
  assert.equal(segs[0].startAt, 100);
  assert.equal(segs[0].timelineOffset, 3);
  assert.equal(segs[0].fadeIn, null);
  near(segs[0].fadeOut.from, 100 + (cycleS - 3) - 1);
  for (let k = 1; k < segs.length; k += 1) {
    const prev = segs[k - 1];
    const cur = segs[k];
    const boundary = 100 + (cycleS - 3) + (k - 1) * cycleS;
    near(cur.startAt, boundary - crossfadeS / 2);
    assert.equal(cur.timelineOffset, -crossfadeS / 2);
    assert.ok(cur.fadeIn);
    near(cur.fadeIn.from, prev.fadeOut.from);
    near(cur.fadeIn.to, prev.fadeOut.to);
    near(prev.stopAt, boundary + crossfadeS / 2);
    assert.ok(cur.startAt <= prev.stopAt, 'no gap between segments');
  }
});

test('crossfade plan continues identically when scheduled in chunks (lookahead timer)', () => {
  const input = { whenS: 5, offsetS: 0, cycleS: 27.5, crossfadeS: 0.03 };
  const once = planLoopSegments({ ...input, untilS: 5 + 4 * 27.5 });
  const first = planLoopSegments({ ...input, untilS: 5 + 1.5 * 27.5 });
  const rest = planLoopSegments({ ...input, untilS: 5 + 4 * 27.5, fromIndex: first[first.length - 1].index + 1 });
  assert.deepEqual([...first, ...rest], once);
});

test('a playback that starts inside the crossfade zone still fades out after it starts', () => {
  const [seg] = planLoopSegments({ whenS: 0, offsetS: 27, cycleS: 27.5, crossfadeS: 2, untilS: 0.1 });
  assert.ok(seg.fadeOut.from >= seg.startAt);
});

test('equal-power curves keep constant power (in^2 + out^2 = 1)', () => {
  const a = equalPowerCurve(64, 'in');
  const b = equalPowerCurve(64, 'out');
  assert.equal(a[0], 0);
  near(a[63], 1, 1e-6);
  for (let i = 0; i < 64; i += 1) near(a[i] ** 2 + b[i] ** 2, 1, 1e-6);
});

/* ---------- music accent map (report only) ---------- */

test('accent alignment only reports the offset to the paired camera cue', () => {
  const track = TRACKS['on-sight'];
  const schedule = cameraSchedule(timeline);
  const loopIn = track.loopInS ?? 0;
  const map: MusicAccentMap = {
    trackId: track.id,
    accents: [
      { id: 'a1', timeS: loopIn + schedule[1].transitionStartS + 0.02, kind: 'downbeat', cameraCueId: schedule[1].cueId },
      { id: 'a2', timeS: loopIn + CYCLE - 0.05, kind: 'hit', cameraCueId: schedule[0].cueId }, // just before the loop start
      { id: 'a3', timeS: loopIn + 3, kind: 'phrase' }, // documented, not paired
    ],
  };
  assert.deepEqual(validateAccentMap(map, track, schedule), []);
  const report = accentAlignment(map, track, schedule, CYCLE);
  assert.deepEqual(report.map((r) => [r.accentId, r.offsetMs]), [['a1', 20], ['a2', -50]]);
  // The schedule itself is untouched.
  assert.deepEqual(cameraSchedule(timeline), schedule);
});

test('accent map validation catches wrong track, out-of-loop accents, duplicates and unknown cues', () => {
  const track = TRACKS['on-sight'];
  const schedule = cameraSchedule(timeline);
  const loopIn = track.loopInS ?? 0;
  const errors = validateAccentMap(
    {
      trackId: 'shelter-piano',
      accents: [
        { id: 'x', timeS: loopIn - 1, kind: 'hit' },
        { id: 'x', timeS: loopIn + 1, kind: 'hit', cameraCueId: 'cue-99' },
      ],
    },
    track,
    schedule,
  );
  for (const pattern of [/is for shelter-piano/, /outside the loop/, /duplicate/, /unknown camera cue/]) {
    assert.ok(errors.some((e) => pattern.test(e)), pattern.source);
  }
});
