import type { CSSProperties } from 'react';
import type { Work } from '../types';
import { coverImage, coverPalette } from '../utils/works';

interface WorkCoverProps {
  work: Work;
  number: string;
  /** Eager-load covers that are visible on first paint. */
  eager?: boolean;
  className?: string;
  /** Overrides the image (e.g. a styleframe); null forces the generative cover. */
  image?: string | null;
  /** Seed for the generative palette (defaults to the slug), so one work can have several frames. */
  seed?: string;
}

/**
 * Cover of a work: its own thumbnail or YouTube still when available, otherwise a deterministic
 * generative duotone with the work number (never an invented image).
 */
export function WorkCover({ work, number, eager = false, className, image: imageOverride, seed }: WorkCoverProps) {
  const image = imageOverride === undefined ? coverImage(work) : imageOverride;
  const palette = coverPalette(seed ?? work.slug);
  const style = {
    '--cover-from': palette.from,
    '--cover-to': palette.to,
    '--cover-ink': palette.ink,
    '--cover-angle': `${palette.angle}deg`,
  } as CSSProperties;

  return (
    <span className={['cover', className].filter(Boolean).join(' ')} style={style}>
      {image ? (
        <img src={image} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
      ) : (
        <span className="cover-generated" aria-hidden="true">
          <span className="cover-number">{number}</span>
          <span className="cover-title">{work.title}</span>
        </span>
      )}
    </span>
  );
}
