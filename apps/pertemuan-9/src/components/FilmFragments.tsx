import { memo } from 'react';
import type { FilmFragmentSpec } from '../showroom/fragments.ts';

interface FilmFragmentsProps {
  fragments: readonly FilmFragmentSpec[];
  scale: number;
  register: (id: string, el: HTMLElement | null) => void;
}

/**
 * Small cut pieces of film stock floating in the room: a handful of static DOM boxes with deterministic ids,
 * positions, rotations and depth (see showroom/fragments.ts). The anchor is placed once; the camera renderer only
 * adjusts the anchor's opacity (distance fog). Slow drift, when enabled, is a CSS animation on the inner element.
 */
export const FilmFragments = memo(function FilmFragments({ fragments, scale, register }: FilmFragmentsProps) {
  return (
    <>
      {fragments.map((f) => (
        <div
          key={f.id}
          className="fragment-anchor"
          data-fragment-id={f.id}
          ref={(el) => register(f.id, el)}
          style={{
            transform: `translate3d(${f.x * scale}px, ${f.y * scale}px, ${f.z * scale}px) rotateX(${f.rotX}deg) rotateY(${f.rotY}deg) rotateZ(${f.rotZ}deg)`,
          }}
        >
          <span
            className="fragment"
            data-variant={f.variant}
            data-layer={f.depthLayer}
            data-drift={f.drift ? '' : undefined}
            style={{ width: f.w * scale, height: f.h * scale, animationDelay: `-${(Number(f.id.slice(5)) * 3.7) % 20}s` }}
          />
        </div>
      ))}
    </>
  );
});
