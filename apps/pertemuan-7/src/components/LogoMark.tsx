import type { Ref } from 'react';
import { nibOffsets, SIGNATURE_STROKES } from '../logo/signature';

interface LogoMarkProps {
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

const NIB = nibOffsets(1.8, 7);

/*
 * The owner's signature "F" (paths in logo/signature.ts). Each path has pathLength 1, so the gate can "write" the
 * letter stroke by stroke with stroke-dashoffset (loader.css).
 */
export function LogoMark({ className, ref }: LogoMarkProps) {
  return (
    <svg ref={ref} className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="currentColor" />
      <g className="ink" fill="none" stroke="var(--color-bg-dark)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {SIGNATURE_STROKES.map((d, stroke) => (
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
