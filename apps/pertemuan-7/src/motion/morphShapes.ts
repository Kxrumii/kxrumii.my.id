/*
 * Shape Morph — pure logic (no DOM). Independent of Camera Choreography: it is used only for hover/focus, Detail
 * open/close and About open/close, and never starts because the camera moved between works.
 *
 * Every shape belongs to one geometry family: an axis-aligned rectangle with rounded corners, expressed as
 * `clip-path: inset(t% r% b% l% round Rpx)`, so shapes interpolate linearly per component (no polygons/SVG).
 * The film perforation is NOT part of the clip-path: it is a separate overlay whose opacity is animated separately.
 *
 * The presets are a PROPOSAL (R-MS), not a final visual decision.
 */

export type MorphContext = 'hover' | 'detail' | 'about';
export type PresetName = 'frame' | 'hover' | 'fragment' | 'slit';

export interface MorphShape {
  /** Percent of the mask box: top, right, bottom, left. */
  inset: readonly [number, number, number, number];
  radiusPx: number;
  /** 0..1: opacity of the perforation overlay. */
  perforation: number;
}

export const MORPH_PRESETS: Readonly<Record<PresetName, MorphShape>> = {
  frame: { inset: [0, 0, 0, 0], radiusPx: 4, perforation: 0 },
  hover: { inset: [1.5, 1.5, 1.5, 1.5], radiusPx: 10, perforation: 0.6 },
  fragment: { inset: [35, 0, 35, 0], radiusPx: 2, perforation: 1 },
  slit: { inset: [0, 49, 0, 49], radiusPx: 2, perforation: 0 },
};

export type MorphEasing = 'out' | 'in-out' | 'spring';
export type MorphSpecKey = 'hover-enter' | 'hover-leave' | 'detail-open' | 'detail-close' | 'about-open' | 'about-close';

export interface MorphSpec {
  context: MorphContext;
  from: PresetName;
  to: PresetName;
  durationMs: number;
  easing: MorphEasing;
}

/**
 * Detail and About durations follow their existing hosts: detail-open matches the sheet FLIP (500 ms); about-open
 * must fit inside the bridge's depth exit (about 160 ms). When a morph starts from a running one, the runner
 * replaces `from` with the shape reached so far (see shapeAt).
 */
export const MORPH_SPECS: Readonly<Record<MorphSpecKey, MorphSpec>> = {
  'hover-enter': { context: 'hover', from: 'frame', to: 'hover', durationMs: 320, easing: 'out' },
  'hover-leave': { context: 'hover', from: 'hover', to: 'frame', durationMs: 260, easing: 'in-out' },
  'detail-open': { context: 'detail', from: 'hover', to: 'frame', durationMs: 500, easing: 'spring' },
  'detail-close': { context: 'detail', from: 'frame', to: 'hover', durationMs: 340, easing: 'in-out' },
  'about-open': { context: 'about', from: 'frame', to: 'slit', durationMs: 160, easing: 'in-out' },
  'about-close': { context: 'about', from: 'slit', to: 'frame', durationMs: 300, easing: 'spring' },
};

/** The perforation overlay rises late (after ~70%) and falls early (by ~30%), so its holes never sit on a half-formed band. */
const PERFORATION_RISE_AT = 0.7;
const PERFORATION_FALL_BY = 0.3;

export function perforationAt(from: number, to: number, p: number): number {
  if (p <= 0) return from;
  if (p >= 1) return to;
  if (to > from) return p <= PERFORATION_RISE_AT ? from : from + (to - from) * ((p - PERFORATION_RISE_AT) / (1 - PERFORATION_RISE_AT));
  if (to < from) return p >= PERFORATION_FALL_BY ? to : from + (to - from) * (p / PERFORATION_FALL_BY);
  return from;
}

/** Shape at (eased) progress p in [0, 1]. Exactly `a` at p <= 0 and exactly `b` at p >= 1. */
export function interpolateShape(a: MorphShape, b: MorphShape, p: number): MorphShape {
  if (p <= 0) return a;
  if (p >= 1) return b;
  const lerp = (x: number, y: number) => x + (y - x) * p;
  return {
    inset: [lerp(a.inset[0], b.inset[0]), lerp(a.inset[1], b.inset[1]), lerp(a.inset[2], b.inset[2]), lerp(a.inset[3], b.inset[3])],
    radiusPx: lerp(a.radiusPx, b.radiusPx),
    perforation: perforationAt(a.perforation, b.perforation, p),
  };
}

const num = (value: number): string => String(Number(value.toFixed(3)));

export function toClipPath(shape: MorphShape): string {
  const [t, r, b, l] = shape.inset;
  return `inset(${num(t)}% ${num(r)}% ${num(b)}% ${num(l)}% round ${num(shape.radiusPx)}px)`;
}

export interface OpacityKeyframe {
  offset: number;
  opacity: number;
}

/** Keyframes for the perforation overlay; offsets are in eased-progress space, matching perforationAt(). */
export function perforationKeyframes(from: number, to: number): OpacityKeyframe[] {
  if (to > from) {
    return [
      { offset: 0, opacity: from },
      { offset: PERFORATION_RISE_AT, opacity: from },
      { offset: 1, opacity: to },
    ];
  }
  if (to < from) {
    return [
      { offset: 0, opacity: from },
      { offset: PERFORATION_FALL_BY, opacity: to },
      { offset: 1, opacity: to },
    ];
  }
  return [
    { offset: 0, opacity: from },
    { offset: 1, opacity: to },
  ];
}
