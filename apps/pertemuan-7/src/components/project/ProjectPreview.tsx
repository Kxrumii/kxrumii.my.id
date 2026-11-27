import { useEffect, useState } from 'react';
import { playSound, setMusicDucked } from '../../audio/sound';
import type { Work } from '../../types';
import { Letters } from '../PillButton';
import { WorkCover } from '../WorkCover';

interface ProjectPreviewProps {
  work: Work;
  number: string;
}

/** Full-height preview at the top of the white card: the cover, and the video only after "play". */
export function ProjectPreview({ work, number }: ProjectPreviewProps) {
  const [playing, setPlaying] = useState(false);

  // A playing video ducks the background music; leaving the page restores it.
  useEffect(() => {
    setMusicDucked(playing);
    return () => setMusicDucked(false);
  }, [playing]);

  return (
    <div className="project-preview">
      {playing && work.youtubeVideoId ? (
        <iframe
          className="project-video"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(work.youtubeVideoId)}?autoplay=1&rel=0`}
          title={`${work.title} — video`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          <WorkCover work={work} number={number} eager className="project-preview-cover" />
          {work.youtubeVideoId ? (
            <button
              type="button"
              className="project-play"
              onPointerEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                setPlaying(true);
              }}
            >
              <Letters text="play video" />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
