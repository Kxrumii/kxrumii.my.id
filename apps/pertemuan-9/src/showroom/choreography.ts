import {
  lerpPose,
  type CameraPose,
  type CameraSegment,
  type CameraStop,
  type ChoreographyProfile,
  type FragmentBounds,
  type PoseKeyframe,
  type ProfileId,
  type SegmentKind,
  type ShowroomCue,
  type Vec3,
  type WorldAnchor,
} from './camera.ts';
import { TRANSIT_EASE, TRANSIT_S, TUNE } from './tempo.ts';

/*
 * Authored choreography (owner brief 2026-11-27). The camera does not just push forward: works sit in different
 * directions and depths, and each move has its own character and roll:
 *   1 -> 2  zoom in, roll +10
 *   2 -> 3  zoom out (pull back), roll +90
 *   3 -> 4  zoom in slightly and travel far upwards, roll +6
 *   4 -> 5  zoom in going down again, roll +180
 *   5 -> 1  return, roll +74 (completing 360 in the same direction)
 * Rolls accumulate (0, 10, 100, 106, 286) and each work's anchor carries the same roll, so every work is upright on
 * screen while HOLDing; it is the room around it that appears turned.
 *
 * The camera must never pass through a work (checked by clearance.ts in the tests). Every transition lasts
 * TRANSIT_S with the TRANSIT_EASE curve; holds are HOLD_S (tempo.ts).
 *
 * The cue slugs are the five sample works marked `featured` in src/data/works.ts. When real highlights replace them
 * this choreography must be re-authored for their number (validateTimeline fails loudly on a mismatch).
 * Landscape and portrait share cue order, segment ids, kinds, rolls, easing and DURATIONS; portrait is the same room
 * scaled for its longer viewing distance.
 */

export const PLACEHOLDER_SLUGS = ['sample-work-01', 'sample-work-02', 'sample-work-03', 'sample-work-04', 'sample-work-05'] as const;

export { TRANSIT_S } from './tempo.ts';

const STOP_IDS = ['stop-entry', 'stop-near', 'stop-wide', 'stop-high', 'stop-low'] as const;

interface Via {
  at: number;
  /** Offset from the straight line, in landscape px (scaled with the profile). */
  delta: Partial<Vec3>;
}

interface MovePlan {
  id: string;
  kind: SegmentKind;
  rollTurn: number;
  via: readonly Via[];
}

/** One move per transition, in cue order; the last one closes the loop. Roll turns sum to 360. */
const MOVES: readonly MovePlan[] = [
  // Bows out to the right so the camera clears the edge of work 1 while pushing past it.
  { id: 'seg-push-tilt', kind: 'push-in', rollTurn: 10, via: [{ at: 0.4, delta: { x: 420, y: 60 } }] },
  { id: 'seg-pull-quarter', kind: 'pull-back', rollTurn: 90, via: [] },
  { id: 'seg-rise', kind: 'mixed', rollTurn: 6, via: [] },
  { id: 'seg-dive-flip', kind: 'roll', rollTurn: 180, via: [] },
  { id: 'seg-return', kind: 'pull-back', rollTurn: 74, via: [{ at: 0.55, delta: { x: -1300, y: 500 } }] },
];

/** Work positions in the landscape room (px at 1440x900; the camera holds HOLD_DISTANCE in front of each). */
const LANDSCAPE_POSITIONS: readonly Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 900, y: 120, z: -1800 },
  { x: 1500, y: -150, z: -300 },
  { x: 1300, y: -1600, z: -600 },
  { x: 300, y: -300, z: -2600 },
];

interface ProfileConfig {
  id: ProfileId;
  referenceViewport: { w: number; h: number };
  perspectivePx: number;
  /** Camera-to-work distance at HOLD. */
  distance: number;
  /** Scale applied to the landscape room (positions and via offsets). */
  roomScale: number;
  frameBox: { w: number; h: number };
  fragmentCount: number;
  fragmentBounds: FragmentBounds;
}

/** Camera pose that looks straight at an anchor from `distance`, rolled like the anchor (anchor on the optical axis). */
export function frameAnchor(anchor: Pick<WorldAnchor, 'x' | 'y' | 'z' | 'yaw' | 'roll'>, distance: number): CameraPose {
  const yaw = (anchor.yaw * Math.PI) / 180;
  return {
    x: anchor.x + distance * Math.sin(yaw),
    y: anchor.y,
    z: anchor.z + distance * Math.cos(yaw),
    pitch: 0,
    yaw: anchor.yaw,
    roll: anchor.roll,
  };
}

function viaKeyframes(from: CameraPose, to: CameraPose, via: readonly Via[], scale: number): PoseKeyframe[] {
  return via.map(({ at, delta }) => {
    const base = lerpPose(from, to, at);
    return {
      at,
      position: { x: base.x + (delta.x ?? 0) * scale, y: base.y + (delta.y ?? 0) * scale, z: base.z + (delta.z ?? 0) * scale },
    };
  });
}

/** Reverse of a forward segment (swapped stops, mirrored keyframes, opposite roll turn) with its own duration. */
export function reversedSegment(segment: CameraSegment, id: string, durationS: number): CameraSegment {
  return {
    id,
    fromStop: segment.toStop,
    toStop: segment.fromStop,
    keyframes: [...(segment.keyframes ?? [])].reverse().map((kf) => ({ at: 1 - kf.at, position: { ...kf.position } })),
    durationS,
    easing: segment.easing,
    rollTurn: -segment.rollTurn,
    kind: segment.kind,
  };
}

const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

function buildProfile(config: ProfileConfig): ChoreographyProfile {
  const k = config.roomScale * TUNE.distanceScale;
  let roll = 0;
  const anchors: WorldAnchor[] = LANDSCAPE_POSITIONS.map((p, i) => {
    const anchor = { slug: PLACEHOLDER_SLUGS[i], x: p.x * k, y: p.y * k, z: p.z * k, yaw: 0, roll: normalizeDeg(roll) };
    roll += MOVES[i].rollTurn;
    return anchor;
  });
  const stops: CameraStop[] = anchors.map((anchor, i) => ({
    id: STOP_IDS[i],
    pose: frameAnchor(anchor, config.distance),
    frameBox: { ...config.frameBox },
  }));
  const n = stops.length;

  const outSegments: CameraSegment[] = MOVES.map((move, i) => {
    const from = stops[i].pose;
    const to = { ...stops[(i + 1) % n].pose, roll: from.roll + move.rollTurn };
    return {
      id: move.id,
      fromStop: stops[i].id,
      toStop: stops[(i + 1) % n].id,
      keyframes: viaKeyframes(from, to, move.via, k),
      durationS: TRANSIT_S,
      easing: TRANSIT_EASE,
      rollTurn: move.rollTurn,
      kind: move.kind,
    };
  });

  // back_i: stop i+1 -> stop i, lasting as long as the forward segment that arrives at cue i.
  const backSegments: CameraSegment[] = outSegments.map((out, i) =>
    reversedSegment(out, `${out.id}-rev`, outSegments[(i - 1 + n) % n].durationS),
  );

  const cues: ShowroomCue[] = anchors.map((anchor, i) => ({
    id: `cue-${String(i + 1).padStart(2, '0')}`,
    projectSlug: anchor.slug,
    stopId: stops[i].id,
    outSegmentId: outSegments[i].id,
    backSegmentId: backSegments[i].id,
  }));

  return {
    id: config.id,
    referenceViewport: config.referenceViewport,
    perspectivePx: config.perspectivePx,
    stops,
    segments: [...outSegments, ...backSegments],
    cues,
    anchors,
    fragmentCount: config.fragmentCount,
    fragmentBounds: config.fragmentBounds,
  };
}

export const LANDSCAPE_PROFILE: ChoreographyProfile = buildProfile({
  id: 'landscape',
  referenceViewport: { w: 1440, h: 900 },
  perspectivePx: 1200,
  distance: 1000,
  roomScale: 1,
  frameBox: { w: 720, h: 405 },
  fragmentCount: 24,
  fragmentBounds: { x: [-1400, 2900], y: [-2600, 1300], z: [-3800, 1400] },
});

/** Portrait holds further back (the work fills ~80% of a narrow screen), so the whole room scales with it. */
const PORTRAIT_SCALE = 2.77;

export const PORTRAIT_PROFILE: ChoreographyProfile = buildProfile({
  id: 'portrait',
  referenceViewport: { w: 390, h: 844 },
  perspectivePx: 1200,
  distance: 1000 * PORTRAIT_SCALE,
  roomScale: PORTRAIT_SCALE,
  frameBox: { w: 720, h: 405 },
  fragmentCount: 12,
  fragmentBounds: { x: [-1400 * PORTRAIT_SCALE, 2900 * PORTRAIT_SCALE], y: [-2600 * PORTRAIT_SCALE, 1300 * PORTRAIT_SCALE], z: [-3800 * PORTRAIT_SCALE, 1400 * PORTRAIT_SCALE] },
});

export const PROFILES: Readonly<Record<ProfileId, ChoreographyProfile>> = {
  landscape: LANDSCAPE_PROFILE,
  portrait: PORTRAIT_PROFILE,
};

/**
 * Profile for a viewport, with hysteresis (0.05 on the aspect ratio, 20 px on the width) so a toolbar that
 * collapses or a tiny resize never flips the profile back and forth. Portrait when aspect < 0.8 or width < 600.
 */
export function profileFor(width: number, height: number, current?: ProfileId): ProfileId {
  const aspect = height > 0 ? width / height : 1;
  if (current === 'portrait') return aspect >= 0.85 && width >= 620 ? 'landscape' : 'portrait';
  if (current === 'landscape') return aspect < 0.75 || width < 580 ? 'portrait' : 'landscape';
  return aspect < 0.8 || width < 600 ? 'portrait' : 'landscape';
}
