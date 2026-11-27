import {
  lerpPose,
  type CameraPose,
  type CameraSegment,
  type CameraStop,
  type ChoreographyProfile,
  type EasingName,
  type FragmentBounds,
  type PoseKeyframe,
  type ProfileId,
  type SegmentKind,
  type ShowroomCue,
  type WorldAnchor,
} from './camera.ts';

/*
 * Authored choreography for the sample works.
 *
 * PLACEHOLDER_TIMING: every number here (poses, deltas, durations) is a prototype value to be tuned visually in the
 * browser. None of it is derived from a beat map: music cues only decide when a transition STARTS.
 *
 * The cue slugs below are the five sample works in src/data/works.ts. When real works replace the samples this
 * choreography must be re-authored (validateTimeline(profile, schedule, slugs) fails loudly on a mismatch).
 *
 * Both profiles are built from the same SEGMENT_PLANS, so landscape and portrait share cue order, segment ids,
 * kinds, easings and DURATIONS (one music cue map serves both). Only coordinates, depth, framing and fragment
 * budgets differ.
 */

export const PLACEHOLDER_SLUGS = ['sample-work-01', 'sample-work-02', 'sample-work-03', 'sample-work-04', 'sample-work-05'] as const;

const STOP_IDS = ['stop-entry', 'stop-drift', 'stop-orbit', 'stop-rise', 'stop-return'] as const;

interface Via {
  at: number;
  delta: Partial<CameraPose>;
}

interface SegmentPlan {
  id: string;
  kind: SegmentKind;
  durationS: number;
  easing: EasingName;
  viaLandscape: readonly Via[];
  viaPortrait: readonly Via[];
}

const SEGMENT_PLANS: readonly SegmentPlan[] = [
  {
    id: 'seg-dolly-drift',
    kind: 'mixed',
    durationS: 2.4,
    easing: 'ease-in-out-cubic',
    viaLandscape: [{ at: 0.5, delta: { yaw: 8, y: 40 } }],
    viaPortrait: [{ at: 0.5, delta: { yaw: 6, y: -160 } }],
  },
  {
    id: 'seg-orbit-rise',
    kind: 'orbit',
    durationS: 3.0,
    easing: 'ease-in-out',
    viaLandscape: [{ at: 0.5, delta: { roll: 12, y: -120, yaw: -14 } }],
    viaPortrait: [{ at: 0.5, delta: { roll: 10, y: 260, yaw: -10 } }],
  },
  {
    id: 'seg-pullback-sweep',
    kind: 'pull-back',
    durationS: 3.2,
    easing: 'ease-in-out-cubic',
    viaLandscape: [{ at: 0.4, delta: { z: 900, x: 260 } }],
    viaPortrait: [{ at: 0.4, delta: { z: 1500, y: -240 } }],
  },
  {
    id: 'seg-flip-reveal',
    kind: 'roll',
    durationS: 2.8,
    easing: 'ease-in-out',
    // Inverted intermediate composition; every HOLD pose is upright (validated).
    viaLandscape: [{ at: 0.5, delta: { roll: 180 } }],
    viaPortrait: [{ at: 0.5, delta: { roll: 180 } }],
  },
  {
    id: 'seg-return',
    kind: 'pull-back',
    durationS: 3.6,
    easing: 'ease-in-out-cubic',
    // Loop-closing segment: last work back to the first, so the cycle has no camera jump.
    viaLandscape: [{ at: 0.5, delta: { y: -200, yaw: 10 } }],
    viaPortrait: [{ at: 0.5, delta: { y: 400, yaw: 8 } }],
  },
];

interface ProfileConfig {
  id: ProfileId;
  referenceViewport: { w: number; h: number };
  perspectivePx: number;
  /** Camera-to-work distance at HOLD. */
  distance: number;
  frameBox: { w: number; h: number };
  anchors: readonly Omit<WorldAnchor, 'slug'>[];
  fragmentCount: number;
  fragmentBounds: FragmentBounds;
}

/** Camera pose that looks straight at an anchor from `distance` (anchor on the optical axis). */
export function frameAnchor(anchor: Pick<WorldAnchor, 'x' | 'y' | 'z' | 'yaw'>, distance: number): CameraPose {
  const yaw = (anchor.yaw * Math.PI) / 180;
  return {
    x: anchor.x + distance * Math.sin(yaw),
    y: anchor.y,
    z: anchor.z + distance * Math.cos(yaw),
    pitch: 0,
    yaw: anchor.yaw,
    roll: 0,
  };
}

function viaKeyframes(from: CameraPose, to: CameraPose, via: readonly Via[]): PoseKeyframe[] {
  return via.map(({ at, delta }) => {
    const base = lerpPose(from, to, at);
    return {
      at,
      pose: {
        x: base.x + (delta.x ?? 0),
        y: base.y + (delta.y ?? 0),
        z: base.z + (delta.z ?? 0),
        pitch: base.pitch + (delta.pitch ?? 0),
        yaw: base.yaw + (delta.yaw ?? 0),
        roll: base.roll + (delta.roll ?? 0),
      },
    };
  });
}

/** Reverse of a forward segment (swapped stops, mirrored keyframes) with its own duration. */
export function reversedSegment(segment: CameraSegment, id: string, durationS: number): CameraSegment {
  return {
    id,
    fromStop: segment.toStop,
    toStop: segment.fromStop,
    keyframes: [...(segment.keyframes ?? [])].reverse().map((kf) => ({ at: 1 - kf.at, pose: { ...kf.pose } })),
    durationS,
    easing: segment.easing,
    kind: segment.kind,
  };
}

function buildProfile(config: ProfileConfig): ChoreographyProfile {
  const anchors: WorldAnchor[] = config.anchors.map((anchor, k) => ({ slug: PLACEHOLDER_SLUGS[k], ...anchor }));
  const stops: CameraStop[] = anchors.map((anchor, k) => ({
    id: STOP_IDS[k],
    pose: frameAnchor(anchor, config.distance),
    frameBox: { ...config.frameBox },
  }));
  const n = stops.length;

  const outSegments: CameraSegment[] = SEGMENT_PLANS.map((plan, k) => {
    const from = stops[k].pose;
    const to = stops[(k + 1) % n].pose;
    return {
      id: plan.id,
      fromStop: stops[k].id,
      toStop: stops[(k + 1) % n].id,
      keyframes: viaKeyframes(from, to, config.id === 'landscape' ? plan.viaLandscape : plan.viaPortrait),
      durationS: plan.durationS,
      easing: plan.easing,
      kind: plan.kind,
    };
  });

  // back_k: stop k+1 -> stop k, lasting as long as the forward segment that arrives at cue k.
  const backSegments: CameraSegment[] = outSegments.map((out, k) =>
    reversedSegment(out, `${out.id}-rev`, outSegments[(k - 1 + n) % n].durationS),
  );

  const cues: ShowroomCue[] = anchors.map((anchor, k) => ({
    id: `cue-${String(k + 1).padStart(2, '0')}`,
    projectSlug: anchor.slug,
    stopId: stops[k].id,
    outSegmentId: outSegments[k].id,
    backSegmentId: backSegments[k].id,
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
  frameBox: { w: 720, h: 405 },
  anchors: [
    { x: 0, y: 0, z: 0, yaw: 0, roll: 0 },
    { x: 1000, y: -140, z: -1500, yaw: -20, roll: 0 },
    { x: -800, y: 180, z: -3000, yaw: 24, roll: 0 },
    { x: 350, y: -340, z: -4400, yaw: -8, roll: 0 },
    { x: -1100, y: 120, z: -5800, yaw: 32, roll: 0 },
  ],
  fragmentCount: 24,
  fragmentBounds: { x: [-2400, 2400], y: [-1200, 1200], z: [-6500, 800] },
});

export const PORTRAIT_PROFILE: ChoreographyProfile = buildProfile({
  id: 'portrait',
  referenceViewport: { w: 390, h: 844 },
  perspectivePx: 1200,
  distance: 2770,
  frameBox: { w: 720, h: 405 },
  anchors: [
    { x: 0, y: 0, z: 0, yaw: 0, roll: 0 },
    { x: 260, y: -700, z: -1200, yaw: -14, roll: 0 },
    { x: -300, y: 650, z: -2400, yaw: 16, roll: 0 },
    { x: 180, y: -900, z: -3600, yaw: -6, roll: 0 },
    { x: -340, y: 500, z: -4800, yaw: 22, roll: 0 },
  ],
  fragmentCount: 12,
  fragmentBounds: { x: [-1400, 1400], y: [-1800, 1800], z: [-6500, 800] },
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
