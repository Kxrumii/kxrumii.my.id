import { useState } from 'react';
import { playSound } from '../../audio/sound';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Work } from '../../types';
import { assetUrl, coverImage, isSquare, previewUrl } from '../../utils/works';
import { Letters } from '../PillButton';
import { WorkCover } from '../WorkCover';
import { VideoPlayer } from './VideoPlayer';

interface ProjectPreviewProps {
  work: Work;
  number: string;
}

/**
 * Preview setinggi layar di atas kartu putih: loop karya yang muted (cover pas loading, atau selamanya kalau file
 * loop-nya nggak ada di server). Klik, atau "play", buka player layar penuh. Karya yang belum ada di YouTube
 * bilang begitu.
 */
export function ProjectPreview({ work, number }: ProjectPreviewProps) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [loopFailed, setLoopFailed] = useState(false);
  const poster = coverImage(work);
  const loop = reducedMotion || loopFailed ? null : previewUrl(work);
  const playable = work.youtubeVideoId !== null;
  const thumbs = [work.cover, ...work.styleframes].filter((path): path is string => Boolean(path)).slice(0, 4).map(assetUrl);

  const openPlayer = () => {
    if (!playable) return;
    playSound('open');
    setOpen(true);
  };

  return (
    <div className={`project-preview${playable ? ' playable' : ''}`} data-shape={isSquare(work) ? 'square' : undefined} onClick={openPlayer}>
      {loop ? (
        <video
          className="project-preview-video"
          src={loop}
          poster={poster ?? undefined}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setLoopFailed(true)}
        />
      ) : (
        <WorkCover work={work} number={number} eager className="project-preview-cover" />
      )}
      {playable ? (
        <button
          type="button"
          className="project-play"
          onPointerEnter={() => playSound('hover')}
          onClick={(event) => {
            event.stopPropagation();
            openPlayer();
          }}
        >
          <Letters text="play video" />
        </button>
      ) : (
        <span className="project-play project-play-soon">video segera hadir</span>
      )}
      {open && work.youtubeVideoId ? (
        <VideoPlayer videoId={work.youtubeVideoId} title={work.title} poster={poster} aspect={work.aspect} embedAspect={work.embedAspect} thumbs={thumbs} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
