import { useShowroom } from '../showroom/useShowroom';
import type { Work } from '../types';
import { AtmosphereLayer } from './AtmosphereLayer';
import { AudioToggles } from './AudioToggles';
import { FilmFragments } from './FilmFragments';
import { FocusCaption } from './FocusCaption';
import { GalleryControls } from './GalleryControls';
import { WorkDisplay } from './WorkDisplay';

interface GalleryViewProps {
  /** The curated collection, in order. The choreography is authored per work and never filtered. */
  works: readonly Work[];
  /** Work to start on (the active one when switching from List, or the one a detail URL points at). */
  initialSlug: string | null;
  /** The work sheet is open over the stage. */
  suspended: boolean;
  onFocusChange: (slug: string) => void;
}

/** Aspect ratio of the media, contained in the stop's frame box. Placeholder 16:9 until real media says otherwise. */
const DEFAULT_ASPECT = 16 / 9;

/**
 * Gallery mode: a full-viewport CSS 2.5D room. DOM layers (see styles/showroom.css):
 *   .showroom (input surface) > .showroom-viewport (perspective) > .showroom-camera (preserve-3d, camera transform)
 *   > .anchor (static world placement) > .work-display; film fragments are siblings of the anchors.
 * The camera element's transform is written only by the showroom runtime; displays and fragments never get one.
 */
export function GalleryView({ works, initialSlug, suspended, onFocusChange }: GalleryViewProps) {
  const showroom = useShowroom({ works, initialSlug, suspendedDetail: suspended, onFocusChange });
  const { profile, scale, ui, error } = showroom;
  const focusWork = works.find((work) => work.slug === ui.focusSlug) ?? null;
  // Reduced motion keeps the camera static (phase is always 'hold'), so the active display stays openable.
  const interactive = ui.phase === 'hold' && !suspended;
  const anchors = new Map(profile.anchors.map((anchor) => [anchor.slug, anchor]));
  const frame = profile.stops[0].frameBox;

  return (
    <div
      className="showroom"
      ref={showroom.rootRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="Galeri karya — scroll, geser, atau gunakan panah kiri/kanan"
      data-owner={ui.owner}
      data-phase={ui.phase}
      data-paused={ui.userPaused ? 'true' : undefined}
      data-profile={profile.id}
    >
      <AtmosphereLayer />
      {error ? (
        <p className="showroom-error" role="alert">
          Koreografi kamera belum sesuai dengan data karya ({error}). Gunakan tampilan List.
        </p>
      ) : (
        <div className="showroom-viewport" style={{ perspective: `${profile.perspectivePx * scale}px` }}>
          <div className="showroom-camera" ref={showroom.cameraRef}>
            {works.map((work) => {
              const anchor = anchors.get(work.slug);
              if (!anchor) return null;
              const fitW = Math.min(frame.w, frame.h * (work.aspectRatio ?? DEFAULT_ASPECT)) * scale;
              const fitH = fitW / (work.aspectRatio ?? DEFAULT_ASPECT);
              const active = work.slug === ui.focusSlug;
              return (
                <div
                  key={work.slug}
                  className="anchor"
                  ref={(el) => showroom.registerAnchor(work.slug, el)}
                  style={{ transform: showroom.anchorStyle(anchor) }}
                >
                  <WorkDisplay
                    work={work}
                    width={fitW}
                    height={fitH}
                    active={active}
                    interactive={active && interactive}
                    reducedMotion={ui.reducedMotion}
                    onHoverEnter={showroom.hoverEnter}
                    onHoverLeave={showroom.hoverLeave}
                  />
                </div>
              );
            })}
            <FilmFragments fragments={showroom.fragments} scale={scale} register={showroom.registerFragment} />
          </div>
        </div>
      )}
      <FocusCaption work={focusWork} phase={ui.phase} />
      <AudioToggles />
      <GalleryControls
        paused={ui.userPaused}
        reducedMotion={ui.reducedMotion}
        disabled={works.length < 2 || error !== null}
        onPrev={showroom.prev}
        onNext={showroom.next}
        onTogglePause={showroom.togglePause}
      />
    </div>
  );
}
