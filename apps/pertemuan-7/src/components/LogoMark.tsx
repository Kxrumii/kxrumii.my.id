import { useId, type Ref } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface LogoMarkProps {
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

/*
 * The owner's mark: an off-white disc with a liquid "F". The letter is drawn from soft strokes and drops (a head,
 * a top arm that drips, a rounded middle arm, a heavy foot), then run through a "gooey" filter: blur + an alpha
 * threshold melts the joins together like a fluid, and a slowly drifting turbulence displaces it so the F never
 * sits perfectly still. Reduced motion keeps the shape and drops the drift.
 */
export function LogoMark({ className, ref }: LogoMarkProps) {
  const reducedMotion = useReducedMotion();
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  return (
    <svg ref={ref} className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.1" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise">
            {reducedMotion ? null : <animate attributeName="baseFrequency" dur="8s" values="0.03;0.05;0.03" repeatCount="indefinite" />}
          </feTurbulence>
          <feDisplacementMap in="goo" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="31" fill="currentColor" />
      <g filter={`url(#${filterId})`} fill="var(--color-bg-dark)" stroke="var(--color-bg-dark)" strokeLinecap="round" strokeLinejoin="round">
        {/* stem, slightly swaying, with a heavy foot that drips */}
        <path d="M23.5 48C22.6 39 24.6 28 23.2 16.8" fill="none" strokeWidth="7" />
        <circle cx="24" cy="48.4" r="4.4" stroke="none" />
        <path d="M24 50C24.4 52 23.8 53.4 24.6 55" fill="none" strokeWidth="2.2" />
        <circle cx="24.8" cy="55.8" r="1.6" stroke="none" />
        {/* head and top arm flowing right, then dripping */}
        <circle cx="23.4" cy="17" r="4.2" stroke="none" />
        <path d="M23 16.6C29.5 13.8 37 13.6 44 15.8" fill="none" strokeWidth="6.4" />
        <path d="M44 16C45.6 18.4 45 20.8 45.6 23" fill="none" strokeWidth="3.4" />
        <circle cx="45.7" cy="25.2" r="2.6" stroke="none" />
        {/* middle arm ending in a drop */}
        <path d="M23.6 31.8C27.6 30.2 31.8 30.4 35.2 31.6" fill="none" strokeWidth="5.6" />
        <circle cx="36.4" cy="32" r="3.7" stroke="none" />
      </g>
    </svg>
  );
}
