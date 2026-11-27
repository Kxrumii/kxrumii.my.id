import type { Ref } from 'react';

interface LogoMarkProps {
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

/** The owner's mark: an off-white disc with an "F". Shared by the top-left logo and the intro gate. */
export function LogoMark({ className, ref }: LogoMarkProps) {
  return (
    <svg ref={ref} className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="currentColor" />
      <path d="M25 47V17h16M25 32h12" stroke="var(--color-bg-dark)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
