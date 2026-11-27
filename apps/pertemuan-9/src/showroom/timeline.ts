import {
  POSE_KEYS,
  ease,
  isValidEasing,
  sameAngle,
  samplePath,
  unwrappedTarget,
  type CameraPose,
  type CameraSegment,
  type CameraStop,
  type ChoreographyProfile,
  type ShowroomCue,
} from './camera.ts';
import { HOLD_S } from './tempo.ts';
import { wrapTime } from './time.ts';

/*
 * Timeline = choreography profile + schedule. All times are seconds on the loop timeline [0, cycleS).
 *
 * The schedule decides WHEN each transition starts. It is fixed (owner decision): equal holds (HOLD_S) and the
 * segments' own durations (TRANSIT_S each). Music follows this schedule and never changes it. The duration and
 * easing of a transition always come from its CameraSegment and are never stretched to fit.
 * sceneAt() returns camera state only; it has no notion of Shape Morph.
 */

/** [REKOMENDASI R-TIME] minimum hold between arrival and the next transition start (prototype value). */
export const MIN_HOLD_S = 1.5;
/** Owner decision: every hold lasts the same time (6 beats, see tempo.ts). */
export { HOLD_S } from './tempo.ts';
/** Focus (caption/active work) switches to the target at this fraction of a transition. */
export const FOCUS_SWITCH_AT = 0.5;

export type Variant = 'forward' | 'back';

export interface Schedule {
  cycleS: number;
  /** Transition start per cue (same order as profile.cues), strictly increasing within [0, cycleS). */
  transitionStartS: readonly number[];
}

export interface TimelineCue {
  index: number;
  cue: ShowroomCue;
  stop: CameraStop;
  outSegment: CameraSegment;
  backSegment: CameraSegment;
  transitionStartS: number;
  /** transitionStartS + durationS (may exceed cycleS for the last cue; positions wrap). */
  arrivalS: number;
  durationS: number;
  /** Where the hold on this cue begins (wrapped) and how long it lasts. */
  holdStartS: number;
  holdS: number;
}

export interface Timeline {
  profile: ChoreographyProfile;
  cycleS: number;
  cues: readonly TimelineCue[];
}

export interface SceneState {
  camera: CameraPose;
  focusIndex: number;
  focusSlug: string;
  phase: 'hold' | 'transit';
  /** Segment being travelled (null while holding). */
  segmentId: string | null;
  /** Linear time progress through the transition (0 while holding). */
  segmentProgress: number;
  variant: Variant;
  /** Index of the outgoing cue whose window contains t (-1 while holding). */
  windowIndex: number;
}

export interface NavPlan {
  /** Timeline position to seek to before playing the fixed transition at normal speed. */
  seekToS: number;
  variant: Variant;
  windowIndex: number;
  targetIndex: number;
  durationS: number;
}

const EPS = 1e-9;
const finite = (n: number): boolean => Number.isFinite(n);
const poseFinite = (pose: CameraPose): boolean => POSE_KEYS.every((key) => finite(pose[key]));

/** Hold lengths for a schedule; the first cue's hold wraps across the loop boundary. */
export function holdLengths(durations: readonly number[], schedule: Schedule): number[] {
  const n = schedule.transitionStartS.length;
  return schedule.transitionStartS.map((tl, k) => {
    const prev = (k - 1 + n) % n;
    const prevArrival = schedule.transitionStartS[prev] + durations[prev];
    return k === 0 ? tl + schedule.cycleS - prevArrival : tl - prevArrival;
  });
}

export function validateSchedule(durations: readonly number[], schedule: Schedule, minHoldS: number = MIN_HOLD_S): string[] {
  const errors: string[] = [];
  const n = durations.length;
  if (!(schedule.cycleS > 0) || !finite(schedule.cycleS)) errors.push('cycleS must be a positive number');
  if (schedule.transitionStartS.length !== n) {
    errors.push(`schedule has ${schedule.transitionStartS.length} cue times, expected ${n}`);
    return errors;
  }
  schedule.transitionStartS.forEach((tl, k) => {
    if (!finite(tl) || tl < 0 || tl >= schedule.cycleS) errors.push(`cue ${k}: transitionStartS ${tl} outside [0, cycleS)`);
    if (k > 0 && !(tl > schedule.transitionStartS[k - 1])) errors.push(`cue ${k}: transitionStartS must be strictly increasing`);
  });
  if (errors.length > 0) return errors;
  // A hold below the minimum also rules out overlapping windows (the hold would be negative).
  holdLengths(durations, schedule).forEach((hold, k) => {
    if (hold < minHoldS - EPS) errors.push(`cue ${k}: hold ${hold.toFixed(3)}s is below the minimum ${minHoldS}s (fix the cue, not the animation)`);
  });
  return errors;
}

export function validateProfile(profile: ChoreographyProfile, slugs?: readonly string[]): string[] {
  const errors: string[] = [];
  const n = profile.cues.length;
  if (n < 2) errors.push('a profile needs at least 2 cues');

  const unique = (label: string, ids: readonly string[]) => {
    if (new Set(ids).size !== ids.length) errors.push(`${label} ids must be unique`);
  };
  unique('stop', profile.stops.map((s) => s.id));
  unique('segment', profile.segments.map((s) => s.id));
  unique('cue', profile.cues.map((c) => c.id));
  unique('cue slug', profile.cues.map((c) => c.projectSlug));

  const stopById = new Map(profile.stops.map((s) => [s.id, s]));
  const segById = new Map(profile.segments.map((s) => [s.id, s]));

  for (const stop of profile.stops) {
    if (!poseFinite(stop.pose)) errors.push(`stop ${stop.id}: pose must be finite`);
  }
  for (const seg of profile.segments) {
    if (!(seg.durationS > 0) || !finite(seg.durationS)) errors.push(`segment ${seg.id}: durationS must be positive`);
    if (!isValidEasing(seg.easing)) errors.push(`segment ${seg.id}: invalid easing`);
    if (!finite(seg.rollTurn)) errors.push(`segment ${seg.id}: rollTurn must be finite`);
    if (!stopById.has(seg.fromStop) || !stopById.has(seg.toStop)) errors.push(`segment ${seg.id}: unknown stop`);
    else if (!sameAngle(stopById.get(seg.fromStop)!.pose.roll + seg.rollTurn, stopById.get(seg.toStop)!.pose.roll)) {
      errors.push(`segment ${seg.id}: start roll + rollTurn must land on the arrival roll`);
    }
    let previous = 0;
    for (const kf of seg.keyframes ?? []) {
      if (!(kf.at > previous) || !(kf.at < 1)) errors.push(`segment ${seg.id}: keyframe 'at' must be strictly increasing inside (0, 1)`);
      if (![kf.position.x, kf.position.y, kf.position.z].every(finite)) errors.push(`segment ${seg.id}: keyframe position must be finite`);
      previous = kf.at;
    }
  }
  const anchorBySlug = new Map(profile.anchors.map((a) => [a.slug, a]));
  const anchorSlugs = new Set(anchorBySlug.keys());
  for (const cue of profile.cues) {
    if (!stopById.has(cue.stopId)) errors.push(`cue ${cue.id}: unknown stop ${cue.stopId}`);
    if (!segById.has(cue.outSegmentId)) errors.push(`cue ${cue.id}: unknown out segment ${cue.outSegmentId}`);
    if (!segById.has(cue.backSegmentId)) errors.push(`cue ${cue.id}: unknown back segment ${cue.backSegmentId}`);
    if (!anchorSlugs.has(cue.projectSlug)) errors.push(`cue ${cue.id}: no world anchor for ${cue.projectSlug}`);
    // The work must look upright while held: the camera's roll at its stop matches the anchor's roll.
    const stop = stopById.get(cue.stopId);
    const anchor = anchorBySlug.get(cue.projectSlug);
    if (stop && anchor && !sameAngle(stop.pose.roll, anchor.roll)) errors.push(`cue ${cue.id}: hold roll must match the work's roll (upright on screen)`);
  }
  if (slugs) {
    const expected = new Set(slugs);
    const actual = new Set(profile.cues.map((c) => c.projectSlug));
    if (expected.size !== actual.size || [...expected].some((slug) => !actual.has(slug))) {
      errors.push('cue slugs do not match the works data (one cue per work)');
    }
  }
  if (errors.length > 0) return errors;

  profile.cues.forEach((cue, k) => {
    const next = profile.cues[(k + 1) % n];
    const prev = profile.cues[(k - 1 + n) % n];
    const out = segById.get(cue.outSegmentId)!;
    const back = segById.get(cue.backSegmentId)!;
    const arrivingForward = segById.get(prev.outSegmentId)!;
    if (out.fromStop !== cue.stopId || out.toStop !== next.stopId) errors.push(`cue ${cue.id}: out segment must run stop ${cue.stopId} -> ${next.stopId}`);
    if (back.fromStop !== next.stopId || back.toStop !== cue.stopId) errors.push(`cue ${cue.id}: back segment must run stop ${next.stopId} -> ${cue.stopId}`);
    if (Math.abs(back.durationS - arrivingForward.durationS) > EPS) {
      errors.push(`cue ${cue.id}: back segment duration must equal the forward segment arriving at it`);
    }
    if (Math.abs(back.rollTurn + out.rollTurn) > EPS) errors.push(`cue ${cue.id}: back segment must turn back the same roll`);
  });
  const totalTurn = profile.cues.reduce((sum, cue) => sum + segById.get(cue.outSegmentId)!.rollTurn, 0);
  if (!sameAngle(totalTurn, 0)) errors.push(`the loop's roll turns must add up to a whole number of turns (got ${totalTurn})`);
  return errors;
}

export function validateTimeline(
  profile: ChoreographyProfile,
  schedule: Schedule,
  slugs?: readonly string[],
  minHoldS: number = MIN_HOLD_S,
): string[] {
  const errors = validateProfile(profile, slugs);
  if (errors.length > 0) return errors;
  const segById = new Map(profile.segments.map((s) => [s.id, s]));
  const durations = profile.cues.map((c) => segById.get(c.outSegmentId)!.durationS);
  return validateSchedule(durations, schedule, minHoldS);
}

/** The fixed camera schedule: equal holds, cue 0 starts moving at t = 0. */
export function fixedSchedule(profile: ChoreographyProfile, holdS: number = HOLD_S): Schedule {
  const segById = new Map(profile.segments.map((s) => [s.id, s]));
  const starts: number[] = [];
  let t = 0;
  for (const cue of profile.cues) {
    starts.push(t);
    t += segById.get(cue.outSegmentId)!.durationS + holdS;
  }
  return { cycleS: t, transitionStartS: starts };
}

export function buildTimeline(profile: ChoreographyProfile, schedule: Schedule, minHoldS: number = MIN_HOLD_S): Timeline {
  const errors = validateTimeline(profile, schedule, undefined, minHoldS);
  if (errors.length > 0) throw new Error(`Invalid showroom timeline:\n- ${errors.join('\n- ')}`);

  const stopById = new Map(profile.stops.map((s) => [s.id, s]));
  const segById = new Map(profile.segments.map((s) => [s.id, s]));
  const n = profile.cues.length;
  const durations = profile.cues.map((c) => segById.get(c.outSegmentId)!.durationS);
  const holds = holdLengths(durations, schedule);

  const cues: TimelineCue[] = profile.cues.map((cue, k) => {
    const prev = (k - 1 + n) % n;
    const transitionStartS = schedule.transitionStartS[k];
    const durationS = durations[k];
    return {
      index: k,
      cue,
      stop: stopById.get(cue.stopId)!,
      outSegment: segById.get(cue.outSegmentId)!,
      backSegment: segById.get(cue.backSegmentId)!,
      transitionStartS,
      arrivalS: transitionStartS + durationS,
      durationS,
      holdStartS: wrapTime(schedule.transitionStartS[prev] + durations[prev], schedule.cycleS),
      holdS: holds[k],
    };
  });
  return { profile, cycleS: schedule.cycleS, cues };
}

/** Where the hold on cue `index` begins (the arrival of the transition that leads into it). */
export function holdStartOf(timeline: Timeline, index: number): number {
  return timeline.cues[index].holdStartS;
}

/**
 * Camera state at timeline position `t` (any real number; wrapped). `variant` selects, for the transition window that
 * contains `t`, whether the forward segment or the arriving cue's authored reverse segment is travelled; it has no
 * effect while holding.
 */
export function sceneAt(timeline: Timeline, t: number, variant: Variant = 'forward'): SceneState {
  const { cues, cycleS } = timeline;
  const n = cues.length;
  const tt = wrapTime(t, cycleS);

  for (const c of cues) {
    const offset = wrapTime(tt - c.transitionStartS, cycleS);
    // EPS: at exactly arrivalS, (start + duration) - start can land a hair below duration; that instant is a hold.
    if (offset >= c.durationS - EPS) continue;

    const targetIndex = (c.index + 1) % n;
    const target = cues[targetIndex];
    const progress = offset / c.durationS;
    const back = variant === 'back';
    const segment = back ? target.backSegment : c.outSegment;
    const fromIndex = back ? (targetIndex + 1) % n : c.index;
    const fromStop = cues[fromIndex].stop;
    const camera = samplePath(
      fromStop.pose,
      segment.keyframes,
      unwrappedTarget(fromStop.pose, target.stop.pose, segment.rollTurn),
      ease(segment.easing, progress),
    );
    const focusIndex = progress >= FOCUS_SWITCH_AT ? targetIndex : fromIndex;
    return {
      camera,
      focusIndex,
      focusSlug: cues[focusIndex].cue.projectSlug,
      phase: 'transit',
      segmentId: segment.id,
      segmentProgress: progress,
      variant,
      windowIndex: c.index,
    };
  }

  // Holding: the most recently arrived window decides which work is held.
  let holdIndex = 0;
  let sinceBest = Infinity;
  for (const c of cues) {
    // Shift by EPS so a rounding error just before the arrival instant does not wrap to a full cycle.
    const since = wrapTime(tt - c.arrivalS + EPS, cycleS) - EPS;
    if (since < sinceBest) {
      sinceBest = since;
      holdIndex = (c.index + 1) % n;
    }
  }
  const held = cues[holdIndex];
  return {
    camera: { ...held.stop.pose },
    focusIndex: holdIndex,
    focusSlug: held.cue.projectSlug,
    phase: 'hold',
    segmentId: null,
    segmentProgress: 0,
    variant: 'forward',
    windowIndex: -1,
  };
}

/**
 * Plan for Previous/Next from the work at `currentIndex`. The transport seeks to `seekToS` and then plays normally
 * through the fixed transition; Previous uses the music window that arrives at the target work, with the authored
 * reverse path (same duration) as its visual.
 */
export function navPlan(timeline: Timeline, currentIndex: number, dir: 1 | -1): NavPlan {
  const n = timeline.cues.length;
  if (dir === 1) {
    const window = timeline.cues[currentIndex];
    return {
      seekToS: window.transitionStartS,
      variant: 'forward',
      windowIndex: window.index,
      targetIndex: (currentIndex + 1) % n,
      durationS: window.durationS,
    };
  }
  const targetIndex = (currentIndex - 1 + n) % n;
  const window = timeline.cues[(targetIndex - 1 + n) % n];
  return {
    seekToS: window.transitionStartS,
    variant: 'back',
    windowIndex: window.index,
    targetIndex,
    durationS: window.durationS,
  };
}

export interface CameraScheduleEntry {
  cueId: string;
  fromSlug: string;
  toSlug: string;
  holdS: number;
  transitionS: number;
  /** Relative transition start on the loop timeline. */
  transitionStartS: number;
}

/** Read-only view of the authoritative camera schedule (derived from the timeline, never stored separately). */
export function cameraSchedule(timeline: Timeline): CameraScheduleEntry[] {
  const n = timeline.cues.length;
  return timeline.cues.map((c) => ({
    cueId: c.cue.id,
    fromSlug: c.cue.projectSlug,
    toSlug: timeline.cues[(c.index + 1) % n].cue.projectSlug,
    holdS: c.holdS,
    transitionS: c.durationS,
    transitionStartS: c.transitionStartS,
  }));
}
