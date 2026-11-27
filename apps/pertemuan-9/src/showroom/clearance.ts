import { samplePath, unwrappedTarget, type CameraSegment, type ChoreographyProfile, type Vec3 } from './camera.ts';
import { NEAR_PLANE_FACTOR, worldToAnchor } from './cameraTransform.ts';

/*
 * Owner rule: the camera never passes THROUGH a work. Pure geometry, used as a mandatory test and by the fragment
 * generator (which keeps particles out of the camera's corridor).
 *
 * A work is the rectangle of its frame box (enlarged by `margin` for the film frame around the image) in the local
 * z = 0 plane of its anchor. A segment penetrates a work when consecutive camera positions are on opposite sides of
 * that plane and the crossing point falls inside the rectangle, or when the camera comes closer than the near plane
 * while in front of / behind the rectangle.
 */

export interface Penetration {
  segmentId: string;
  anchorSlug: string;
  /** Path parameter where it happens. */
  at: number;
  kind: 'cross' | 'near';
}

export interface ClearanceOptions {
  /** Extra border as a fraction of the frame size (film frame, sprockets, safety). */
  margin?: number;
  samples?: number;
}

/** Camera positions along a segment (path parameter evenly sampled; easing does not change the path). */
export function segmentPositions(profile: ChoreographyProfile, segment: CameraSegment, samples = 200): Vec3[] {
  const from = profile.stops.find((s) => s.id === segment.fromStop)!.pose;
  const to = unwrappedTarget(from, profile.stops.find((s) => s.id === segment.toStop)!.pose, segment.rollTurn);
  const out: Vec3[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const p = samplePath(from, segment.keyframes, to, i / samples);
    out.push({ x: p.x, y: p.y, z: p.z });
  }
  return out;
}

export function pathPenetrations(profile: ChoreographyProfile, { margin = 0.2, samples = 400 }: ClearanceOptions = {}): Penetration[] {
  const found: Penetration[] = [];
  const near = NEAR_PLANE_FACTOR * profile.perspectivePx;
  const box = profile.stops[0].frameBox;
  const halfW = (box.w / 2) * (1 + margin);
  const halfH = (box.h / 2) * (1 + margin);
  const inside = (p: Vec3) => Math.abs(p.x) <= halfW && Math.abs(p.y) <= halfH;

  for (const segment of profile.segments) {
    const positions = segmentPositions(profile, segment, samples);
    for (const anchor of profile.anchors) {
      const local = positions.map((p) => worldToAnchor(anchor, p));
      for (let i = 0; i < local.length; i += 1) {
        const q = local[i];
        if (Math.abs(q.z) < near && inside(q)) {
          found.push({ segmentId: segment.id, anchorSlug: anchor.slug, at: i / samples, kind: 'near' });
          break;
        }
        if (i === 0) continue;
        const prev = local[i - 1];
        if ((prev.z > 0) !== (q.z > 0)) {
          const f = prev.z / (prev.z - q.z);
          const hit = { x: prev.x + (q.x - prev.x) * f, y: prev.y + (q.y - prev.y) * f, z: 0 };
          if (inside(hit)) {
            found.push({ segmentId: segment.id, anchorSlug: anchor.slug, at: (i - 1 + f) / samples, kind: 'cross' });
            break;
          }
        }
      }
    }
  }
  return found;
}

/** Points along every segment, for keeping decorative fragments out of the camera's way. */
export function cameraCorridor(profile: ChoreographyProfile, samples = 60): Vec3[] {
  return profile.segments.flatMap((segment) => segmentPositions(profile, segment, samples));
}

/** Keep fragments out of the camera's corridor and off the works (radius ~45% of the hold distance). */
export function fragmentClearance(profile: ChoreographyProfile): { avoid: Vec3[]; radius: number } {
  const holdDistance = Math.abs(profile.stops[0].pose.z - profile.anchors[0].z);
  return { avoid: [...cameraCorridor(profile), ...profile.anchors], radius: holdDistance * 0.45 };
}
