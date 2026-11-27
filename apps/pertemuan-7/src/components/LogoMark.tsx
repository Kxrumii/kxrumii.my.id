import type { Ref } from 'react';

interface LogoMarkProps {
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

/*
 * The owner's mark: an off-white disc with a calligraphic "F", written as with a broad-nib pen. Each stroke's
 * centre line is drawn several times, shifted along the nib (40°, 5.2 units wide), so the letter gets real
 * thick/thin contrast: wide on the downstroke, hairline on the cross-strokes. Strokes, in writing order: the top
 * swash with its entry curl, the stem ending in a tail, the crossbar. Each path has pathLength 1, so the gate can
 * "write" the letter with stroke-dashoffset (loader.css).
 */
const STROKES = [
  'M18 20.5C17 16.2 22.4 14 27 15.8C31.6 17.6 37 17 42.6 13.8C44.6 12.7 46.8 13 47.2 14.8',
  'M30.6 16.6C32.2 24 31 33.6 28.4 41C26.6 46.4 22.4 50.2 18 48.6C15.8 47.8 16 45 18.4 45.2',
  'M22.8 32.6C25.4 30.8 29 30.6 32.4 31.4C34.6 31.9 36.6 31.2 38 29.8',
];
const NIB_ANGLE = (40 * Math.PI) / 180;
const NIB_WIDTH = 5.2;
const NIB_STEPS = 13;
const NIB = Array.from({ length: NIB_STEPS }, (_, i) => {
  const t = -NIB_WIDTH / 2 + (NIB_WIDTH * i) / (NIB_STEPS - 1);
  return `translate(${(Math.cos(NIB_ANGLE) * t).toFixed(3)} ${(-Math.sin(NIB_ANGLE) * t).toFixed(3)})`;
});

export function LogoMark({ className, ref }: LogoMarkProps) {
  return (
    <svg ref={ref} className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="currentColor" />
      <g className="ink" fill="none" stroke="var(--color-bg-dark)" strokeWidth="1" strokeLinecap="round" transform="translate(32 32) scale(1.06) translate(-32 -32)">
        {STROKES.map((d, stroke) => (
          <g key={stroke} className={`ink-stroke ink-stroke-${stroke}`}>
            {NIB.map((offset, i) => (
              <path key={i} d={d} transform={offset} pathLength={1} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
