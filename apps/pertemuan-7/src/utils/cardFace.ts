import type { Work } from '../types';

export interface CardFace {
  /** CSS `background` value for the card. */
  background: string;
  /** Three colours shown as Huy-style project swatches. */
  swatches: [string, string, string];
  /** Text colour that stays readable on the background. */
  ink: string;
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

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`;

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
  const swatches: [string, string, string] = [
    hsl(hue, 72, light),
    hsl(hue + shift, 64, Math.min(light + 26, 86)),
    hsl(hue + 180 + shift / 2, 58, Math.max(light - 22, 14)),
  ];
  const angle = 110 + ((seed >>> 4) % 80);
  const generated = [
    `radial-gradient(120% 90% at 18% 12%, ${swatches[1]} 0%, transparent 58%)`,
    `radial-gradient(90% 80% at 85% 90%, ${swatches[2]} 0%, transparent 62%)`,
    `linear-gradient(${angle}deg, ${swatches[0]}, ${swatches[2]})`,
  ].join(', ');
  const background = work.thumbnail
    ? `center / cover no-repeat url(${JSON.stringify(work.thumbnail)}), ${generated}`
    : generated;
  return { background, swatches, ink: light < 50 ? '#f4f4f2' : '#141414' };
}
