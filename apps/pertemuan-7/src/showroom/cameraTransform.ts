import type { CameraPose } from './camera.ts';
import { clamp } from './time.ts';

/*
 * Camera pose -> CSS. The camera is rendered as the inverse of its own transform applied to the whole scene:
 *   translateZ(P) rotateZ(-roll) rotateX(-pitch) rotateY(-yaw) translate3d(-x, -y, -z)
 * (CSS applies the list right-to-left to a point.) With `perspective: P` on the viewport, translateZ(P) puts the
 * camera at the eye, so a point `d` in front of the camera is scaled by P / d.
 */

const DEG = Math.PI / 180;

/** Nearest depth (as a fraction of the perspective) before a display is faded out, to avoid huge/clipped frames. */
export const NEAR_PLANE_FACTOR = 0.25;
/** Fog: opacity falls from 1 at FOG_START to 0 at FOG_END, both as multiples of the perspective. */
export const FOG_START_FACTOR = 5;
export const FOG_END_FACTOR = 9;

const fmt = (value: number): string => String(Number(value.toFixed(3)));

export function cameraTransform(pose: CameraPose, perspectivePx: number): string {
  return (
    `translateZ(${fmt(perspectivePx)}px) rotateZ(${fmt(-pose.roll)}deg) rotateX(${fmt(-pose.pitch)}deg) ` +
    `rotateY(${fmt(-pose.yaw)}deg) translate3d(${fmt(-pose.x)}px, ${fmt(-pose.y)}px, ${fmt(-pose.z)}px)`
  );
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** World point in camera space (before translateZ(P)); points in front of the camera have z < 0. */
export function worldToCamera(pose: CameraPose, point: Vec3): Vec3 {
  const vx = point.x - pose.x;
  const vy = point.y - pose.y;
  const vz = point.z - pose.z;

  const ay = -pose.yaw * DEG;
  const x1 = Math.cos(ay) * vx + Math.sin(ay) * vz;
  const z1 = -Math.sin(ay) * vx + Math.cos(ay) * vz;

  const ax = -pose.pitch * DEG;
  const y2 = Math.cos(ax) * vy - Math.sin(ax) * z1;
  const z2 = Math.sin(ax) * vy + Math.cos(ax) * z1;

  const az = -pose.roll * DEG;
  const x3 = Math.cos(az) * x1 - Math.sin(az) * y2;
  const y3 = Math.sin(az) * x1 + Math.cos(az) * y2;

  return { x: x3, y: y3, z: z2 };
}

export interface DepthState {
  /** Distance in front of the camera (<= 0 means at/behind the camera). */
  depth: number;
  /** 0..1: near-plane fade combined with distance fog. */
  opacity: number;
}

export function depthState(pose: CameraPose, point: Vec3, perspectivePx: number): DepthState {
  const depth = -worldToCamera(pose, point).z;
  const near = NEAR_PLANE_FACTOR * perspectivePx;
  const nearFade = clamp((depth - near) / near, 0, 1);
  const fogStart = FOG_START_FACTOR * perspectivePx;
  const fogEnd = FOG_END_FACTOR * perspectivePx;
  const farFade = 1 - clamp((depth - fogStart) / (fogEnd - fogStart), 0, 1);
  return { depth, opacity: Math.min(nearFade, farFade) };
}

/** Static CSS transform of a work display from its world anchor (written once; the camera never touches it). */
export function anchorTransform(anchor: { x: number; y: number; z: number; yaw: number; roll: number }): string {
  return (
    `translate3d(${fmt(anchor.x)}px, ${fmt(anchor.y)}px, ${fmt(anchor.z)}px) ` +
    `rotateY(${fmt(anchor.yaw)}deg) rotateZ(${fmt(anchor.roll)}deg)`
  );
}
