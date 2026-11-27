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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export const POSE_KEYS = ['x', 'y', 'z', 'pitch', 'yaw', 'roll'] as const;
const POSITION_KEYS = ['x', 'y', 'z'] as const;
const ANGLE_KEYS = ['pitch', 'yaw', 'roll'] as const;

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
/** A named curve or CSS-style cubic-bezier control points (x1, y1, x2, y2). */
export type Easing = EasingName | readonly [number, number, number, number];

/** Intermediate camera POSITION along a segment (angles always follow the eased progress straight). */
export interface PoseKeyframe {
  /** Position along the segment, strictly inside (0, 1), strictly increasing. */
  at: number;
  position: Vec3;
}

/** Camera movement only: path, duration, easing, roll turn and a semantic kind. */
export interface CameraSegment {
  id: string;
  fromStop: string;
  toStop: string;
  keyframes?: readonly PoseKeyframe[];
  durationS: number;
  easing: Easing;
  /**
   * Signed roll in degrees travelled by this segment. The arrival roll equals the start roll plus this turn
   * (mod 360), so a turn of +74 from 286 lands on 0 by continuing the same direction instead of spinning back.
   */
  rollTurn: number;
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

/**
 * CSS cubic-bezier(x1, y1, x2, y2) evaluated at time progress x: solve B_x(t) = x (Newton, then bisection as a
 * fallback), return B_y(t). x1 and x2 must be in [0, 1] (as in CSS), which keeps B_x monotonic.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const bx = (t: number) => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const dbx = (t: number) => 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
  const by = (t: number) => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const err = bx(t) - x;
    if (Math.abs(err) < 1e-7) return by(t);
    const d = dbx(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i += 1) {
    const v = bx(t);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

export function isValidEasing(easing: Easing): boolean {
  if (typeof easing === 'string') return easing in EASINGS;
  return easing.length === 4 && easing.every(Number.isFinite) && easing[0] >= 0 && easing[0] <= 1 && easing[2] >= 0 && easing[2] <= 1;
}

/** Eased progress; exactly 0 at p <= 0 and exactly 1 at p >= 1 (no -0, no rounding residue). */
export function ease(easing: Easing, p: number): number {
  if (!(p > 0)) return 0;
  if (p >= 1) return 1;
  if (typeof easing === 'string') return clampUnit(EASINGS[easing](p));
  return cubicBezier(easing[0], easing[1], easing[2], easing[3], p);
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
 * Pose along a segment at path parameter `u` (already eased). Position: a straight line, or with keyframes a cubic
 * Hermite (Catmull-Rom tangents, chord tangents at both ends) through them. Angles: straight from `from` to `to`
 * (pass `to.roll` already unwrapped by the segment's roll turn). u <= 0 / u >= 1 return the end poses exactly.
 */
export function samplePath(
  from: CameraPose,
  keyframes: readonly PoseKeyframe[] | undefined,
  to: CameraPose,
  u: number,
): CameraPose {
  if (!(u > 0)) return { ...from };
  if (u >= 1) return { ...to };
  const knots: Array<{ t: number; p: Vec3 }> = [
    { t: 0, p: from },
    ...(keyframes ?? []).map((k) => ({ t: k.at, p: k.position })),
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

  const tangent = (j: number, key: (typeof POSITION_KEYS)[number]): number => {
    if (j === 0) return (knots[1].p[key] - knots[0].p[key]) / (knots[1].t - knots[0].t);
    if (j === last) return (knots[last].p[key] - knots[last - 1].p[key]) / (knots[last].t - knots[last - 1].t);
    return (knots[j + 1].p[key] - knots[j - 1].p[key]) / (knots[j + 1].t - knots[j - 1].t);
  };

  const out: CameraPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  for (const key of POSITION_KEYS) {
    out[key] = h00 * a.p[key] + h10 * h * tangent(i, key) + h01 * b.p[key] + h11 * h * tangent(i + 1, key);
  }
  for (const key of ANGLE_KEYS) out[key] = from[key] + (to[key] - from[key]) * u;
  return out;
}

/** Arrival pose of a segment with its roll unwrapped (start roll + turn), for continuous interpolation. */
export function unwrappedTarget(from: CameraPose, to: CameraPose, rollTurn: number): CameraPose {
  return { ...to, roll: from.roll + rollTurn };
}

/** a ≡ b (mod 360), within a small tolerance. */
export function sameAngle(a: number, b: number, tolerance = 1e-6): boolean {
  const d = (((a - b) % 360) + 360) % 360;
  return d < tolerance || 360 - d < tolerance;
}
