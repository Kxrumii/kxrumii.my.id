import type { CSSProperties } from 'react';
import type { Work } from '../types';
import { coverImage, coverPalette } from '../utils/works';

interface WorkCoverProps {
  work: Work;
  number: string;
  /** Eager-load cover yang kelihatan di first paint. */
  eager?: boolean;
  className?: string;
  /** Ganti gambarnya (mis. styleframe); null maksa pakai cover generatif. */
  image?: string | null;
  /** Seed palet generatif (default-nya slug), biar satu karya bisa punya beberapa frame. */
  seed?: string;
}

/**
 * Cover karya: thumbnail atau still YouTube-nya kalau ada, kalau nggak duotone generatif yang deterministik
 * dengan nomor karya (nggak pernah gambar karangan).
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
