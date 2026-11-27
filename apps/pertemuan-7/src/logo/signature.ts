/*
 * The owner's mark: a signature-style "F" on an off-white disc. One source for the React logo (LogoMark) and the
 * favicons (tools/favicon.mjs), so the two never drift apart.
 *
 * Strokes, in writing order: the wavy top bar with its entry hook; the stem, which loops at the bottom and swings
 * back up across itself like the tail of a signature; the short crossbar. Each centre line is drawn several times,
 * shifted along a narrow pen nib, so the ink thickens on the downstroke and thins on the sideways strokes.
 */
export const SIGNATURE_STROKES = [
  'M16 23C13.5 17.5 19 13 26 15C31 16.5 35.5 17.5 41.5 14.5C45 12.8 48.5 12.5 50.5 14.5',
  'M33.5 16C32.5 25 31 34.5 28 42C25.5 48.5 20.5 52 16.5 50C13.5 48.5 14.5 44.5 18.5 42.5C23 40 28 38 33 36.5C37.5 35 41.5 33.5 45 31.5',
  'M24 33C27.5 31.5 31.5 31 36 30.5',
] as const;

const NIB_ANGLE = (40 * Math.PI) / 180;

/** Offsets (SVG transforms) that spread one centre line across a pen nib `width` units wide. */
export function nibOffsets(width: number, steps: number): string[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : -width / 2 + (width * i) / (steps - 1);
    return `translate(${(Math.cos(NIB_ANGLE) * t).toFixed(3)} ${(-Math.sin(NIB_ANGLE) * t).toFixed(3)})`;
  });
}

export interface SignatureSvgOptions {
  disc: string;
  ink: string;
  nibWidth: number;
  nibSteps: number;
  strokeWidth: number;
}

/** The mark as a standalone SVG document (used for favicons). */
export function signatureSvg({ disc, ink, nibWidth, nibSteps, strokeWidth }: SignatureSvgOptions): string {
  const offsets = nibOffsets(nibWidth, nibSteps);
  const paths = SIGNATURE_STROKES.map((d) => offsets.map((offset) => `<path d="${d}" transform="${offset}"/>`).join('')).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="31" fill="${disc}"/>` +
    `<g fill="none" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
    `</svg>`
  );
}
