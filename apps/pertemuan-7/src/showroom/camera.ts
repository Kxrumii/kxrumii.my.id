/*
 * Camera Choreography model (declarative, deterministic, independent of project data order).
 *
 * Coordinate system (px at the profile's reference viewport, scaled at render time):
 *   +X right, +Y down, +Z towards the viewer; the camera looks along -Z.
 *   Angles are degrees, positive in the CSS rotate direction (see cameraTransform.ts).
 *
 * This module knows NOTHING about Shape Morph: a camera segment only moves the camera. A work that appears
 * small and then grows is perspective/depth from the camera, not a morph.
 */

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export const POSE_KEYS = ['x', 'y', 'z', 'pitch', 'yaw', 'roll'] as const;

export interface FrameBox {
  w: number;
  h: number;
}

/** A place the camera holds. Ids are independent of project slugs and array indices. */
export interface CameraStop {
  id: string;
  pose: CameraPose;
  frameBox: FrameBox;
}

export type SegmentKind = 'push-in' | 'pull-back' | 'lateral' | 'roll' | 'orbit' | 'mixed';
export type EasingName = 'linear' | 'ease-out' | 'ease-in-out' | 'ease-in-out-cubic';

export interface PoseKeyframe {
  /** Position along the segment, strictly inside (0, 1), strictly increasing. */
  at: number;
  pose: CameraPose;
}

/** Camera movement only: poses, keyframes, duration, easing and a semantic kind. */
export interface CameraSegment {
  id: string;
  fromStop: string;
  toStop: string;
  keyframes?: readonly PoseKeyframe[];
  durationS: number;
  easing: EasingName;
  kind: SegmentKind;
}

/**
 * One cue per work, in curated order. `outSegmentId` travels stop k -> stop k+1 (autoplay, Next).
 * `backSegmentId` travels stop k+1 -> stop k and is used by Previous; its duration must equal the duration of the
 * forward segment that arrives at this cue, so the music window of that arrival still fits.
 */
export interface ShowroomCue {
  id: string;
  projectSlug: string;
  stopId: string;
  outSegmentId: string;
  backSegmentId: string;
}

/** Where a work display sits in the virtual room. Statically positioned; the camera moves, the displays do not. */
export interface WorldAnchor {
  slug: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
}

export interface FragmentBounds {
  x: readonly [number, number];
  y: readonly [number, number];
  z: readonly [number, number];
}

export type ProfileId = 'landscape' | 'portrait';

export interface ChoreographyProfile {
  id: ProfileId;
  referenceViewport: { w: number; h: number };
  perspectivePx: number;
  stops: readonly CameraStop[];
  segments: readonly CameraSegment[];
  cues: readonly ShowroomCue[];
  anchors: readonly WorldAnchor[];
  fragmentCount: number;
  fragmentBounds: FragmentBounds;
}

function clampUnit(p: number): number {
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

export const EASINGS: Readonly<Record<EasingName, (p: number) => number>> = {
  linear: (p) => p,
  'ease-out': (p) => 1 - (1 - p) ** 3,
  'ease-in-out': (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  'ease-in-out-cubic': (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
};

/** Eased progress; exactly 0 at p <= 0 and exactly 1 at p >= 1 (no -0, no rounding residue). */
export function ease(name: EasingName, p: number): number {
  if (!(p > 0)) return 0;
  if (p >= 1) return 1;
  return clampUnit(EASINGS[name](p));
}

export function posesEqual(a: CameraPose, b: CameraPose): boolean {
  return POSE_KEYS.every((key) => a[key] === b[key]);
}

export function lerpPose(a: CameraPose, b: CameraPose, p: number): CameraPose {
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    z: a.z + (b.z - a.z) * p,
    pitch: a.pitch + (b.pitch - a.pitch) * p,
    yaw: a.yaw + (b.yaw - a.yaw) * p,
    roll: a.roll + (b.roll - a.roll) * p,
  };
}

/**
 * Pose along a segment at path parameter `u` (already eased). With no keyframes the path is a straight line; with
 * keyframes it is a cubic Hermite (Catmull-Rom tangents, chord tangents at both ends) through them. u <= 0 / u >= 1
 * return the end poses exactly.
 */
export function samplePath(
  from: CameraPose,
  keyframes: readonly PoseKeyframe[] | undefined,
  to: CameraPose,
  u: number,
): CameraPose {
  if (!(u > 0)) return { ...from };
  if (u >= 1) return { ...to };
  const knots: Array<{ t: number; p: CameraPose }> = [
    { t: 0, p: from },
    ...(keyframes ?? []).map((k) => ({ t: k.at, p: k.pose })),
    { t: 1, p: to },
  ];
  const last = knots.length - 1;
  let i = 0;
  while (i < last - 1 && u > knots[i + 1].t) i += 1;
  const a = knots[i];
  const b = knots[i + 1];
  const h = b.t - a.t;
  const s = (u - a.t) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;

  const tangent = (j: number, key: (typeof POSE_KEYS)[number]): number => {
    if (j === 0) return (knots[1].p[key] - knots[0].p[key]) / (knots[1].t - knots[0].t);
    if (j === last) return (knots[last].p[key] - knots[last - 1].p[key]) / (knots[last].t - knots[last - 1].t);
    return (knots[j + 1].p[key] - knots[j - 1].p[key]) / (knots[j + 1].t - knots[j - 1].t);
  };

  const out: CameraPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  for (const key of POSE_KEYS) {
    out[key] = h00 * a.p[key] + h10 * h * tangent(i, key) + h01 * b.p[key] + h11 * h * tangent(i + 1, key);
  }
  return out;
}
