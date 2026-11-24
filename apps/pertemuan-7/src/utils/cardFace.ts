import type { Work } from '../types';

/** Ink colours a face can carry; every label picks whichever reads better where it sits. */
export const INK_LIGHT = '#f4f4f2';
export const INK_DARK = '#141414';

/**
 * Soft halo in the opposite tone of the ink. A row can still straddle the highlight/shade boundary, where no single
 * ink beats every pixel under the text; the halo evens out the local background without a filter (the spiral's 3D
 * chain must never get one) or a visible box.
 */
export const haloFor = (ink: string): string =>
  ink === INK_DARK
    ? '0 0 8px rgba(255, 255, 255, 0.62), 0 0 2px rgba(255, 255, 255, 0.4)'
    : '0 0 8px rgba(8, 8, 8, 0.58), 0 0 2px rgba(8, 8, 8, 0.38)';

export interface FaceInks {
  /** Index label in the top-left corner. */
  top: string;
  /** Title row, vertically centred on the card. */
  middle: string;
  /** Category label in the bottom-left corner. */
  bottom: string;
  /** Media label and play button, centred on the face. */
  center: string;
}

export interface CardFace {
  /** CSS `background` value for the card. */
  background: string;
  /** Three colours shown as Huy-style project swatches. */
  swatches: [string, string, string];
  /** Text colour for the face as a whole (the media label in the sheet hero reads `inks.center`). */
  ink: string;
  /** Per-row ink: the gradient mixes a bright highlight and a deep shade, so one colour cannot serve every corner. */
  inks: FaceInks;
}

/** FNV-1a 32-bit hash: small, deterministic, good enough to spread hues. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Rgb = [number, number, number];
type Hsl = [number, number, number];

const hslCss = ([h, s, l]: Hsl) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`;

function hslToRgb([h, s, l]: Hsl): Rgb {
  const hue = (((Math.round(h) % 360) + 360) % 360) / 360;
  const sat = s / 100;
  const lig = l / 100;
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const channel = (offset: number) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255];
}

const hexToRgb = (hex: string): Rgb => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Colour of the generated background at a point (x, y in 0..1), replicating the three CSS layers below:
 * two radial highlights over the diagonal linear gradient. CSS interpolates `transparent` premultiplied, so
 * a radial layer keeps its colour and only its alpha falls off.
 */
function sampleFace(swatches: [Rgb, Rgb, Rgb], angle: number, aspect: number, x: number, y: number): Rgb {
  const [s0, s1, s2] = swatches;
  const radial = (cx: number, cy: number, rx: number, ry: number, end: number) => {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return Math.max(0, 1 - t / end);
  };
  const theta = (angle * Math.PI) / 180;
  const dx = Math.sin(theta);
  const dy = -Math.cos(theta);
  // Gradient line length and position, measured in box units (width = aspect, height = 1).
  const length = Math.abs(aspect * dx) + Math.abs(dy);
  const t = Math.min(1, Math.max(0, ((x - 0.5) * aspect * dx + (y - 0.5) * dy) / length + 0.5));
  let color = s0.map((v, i) => v + (s2[i] - v) * t) as Rgb;
  const shade = radial(0.85, 0.9, 0.9, 0.8, 0.62);
  color = color.map((v, i) => v * (1 - shade) + s2[i] * shade) as Rgb;
  const glow = radial(0.18, 0.12, 1.2, 0.9, 0.58);
  return color.map((v, i) => v * (1 - glow) + s1[i] * glow) as Rgb;
}

/** Text rows as fractions of the face: where each label sits in the spiral card, the play face and the sheet hero. */
const ROWS: Record<keyof FaceInks, { xs: number[]; ys: number[] }> = {
  top: { xs: [0.05, 0.08, 0.12], ys: [0.08, 0.13] },
  middle: { xs: [0.05, 0.2, 0.35, 0.5, 0.65], ys: [0.4, 0.5, 0.6] },
  bottom: { xs: [0.05, 0.12, 0.2, 0.3, 0.4], ys: [0.87, 0.92] },
  center: { xs: [0.35, 0.45, 0.55, 0.65], ys: [0.38, 0.5, 0.62] },
};

/** The ink with the best worst-case contrast over every sampled point of the row. */
function pickInk(sample: (x: number, y: number) => Rgb, row: { xs: number[]; ys: number[] }): string {
  const colors = row.ys.flatMap((y) => row.xs.map((x) => sample(x, y)));
  const worst = (ink: string) => Math.min(...colors.map((c) => contrast(hexToRgb(ink), c)));
  return worst(INK_LIGHT) >= worst(INK_DARK) ? INK_LIGHT : INK_DARK;
}

/**
 * Generative face for a work card, derived only from its slug (same slug ->
 * same face on every render and every device). A real thumbnail, when the
 * data provides one, is layered on top of the generated gradient.
 */
export function cardFace(work: Pick<Work, 'slug' | 'thumbnail'>): CardFace {
  const seed = hash(work.slug);
  const hue = seed % 360;
  const shift = 30 + ((seed >>> 9) % 50);
  const light = 38 + ((seed >>> 17) % 22);
  const hsls: [Hsl, Hsl, Hsl] = [
    [hue, 72, light],
    [hue + shift, 64, Math.min(light + 26, 86)],
    [hue + 180 + shift / 2, 58, Math.max(light - 22, 14)],
  ];
  const swatches = hsls.map(hslCss) as [string, string, string];
  const angle = 110 + ((seed >>> 4) % 80);
  const generated = [
    `radial-gradient(120% 90% at 18% 12%, ${swatches[1]} 0%, transparent 58%)`,
    `radial-gradient(90% 80% at 85% 90%, ${swatches[2]} 0%, transparent 62%)`,
    `linear-gradient(${angle}deg, ${swatches[0]}, ${swatches[2]})`,
  ].join(', ');
  const background = work.thumbnail
    ? `center / cover no-repeat url(${JSON.stringify(work.thumbnail)}), ${generated}`
    : generated;

  const rgbs = hsls.map(hslToRgb) as [Rgb, Rgb, Rgb];
  // Rows are sampled on a 16:10 card; the 4:3 play face and 16:9 hero differ only slightly in the linear layer.
  const sample = (x: number, y: number) => sampleFace(rgbs, angle, 1.6, x, y);
  const inks: FaceInks = {
    top: pickInk(sample, ROWS.top),
    middle: pickInk(sample, ROWS.middle),
    bottom: pickInk(sample, ROWS.bottom),
    center: pickInk(sample, ROWS.center),
  };
  return { background, swatches, ink: inks.middle, inks };
}
