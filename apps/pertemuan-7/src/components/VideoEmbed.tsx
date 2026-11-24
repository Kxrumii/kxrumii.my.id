import { useState } from 'react';

interface VideoEmbedProps {
  title: string;
  youtubeVideoId: string | null;
  externalUrl: string | null;
}

/**
 * Four outcomes:
 *  1. video id, not playing  -> facade button (no request to YouTube yet)
 *  2. video id, playing      -> youtube-nocookie iframe, started by the user's click
 *  3. no video, external URL -> link to the original platform
 *  4. neither                -> "video belum tersedia"
 * Re-key by work so the "playing" state never leaks between works.
 */
export function VideoEmbed({ title, youtubeVideoId, externalUrl }: VideoEmbedProps) {
  const [playing, setPlaying] = useState(false);

  if (youtubeVideoId) {
    return (
      <div className="video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}?autoplay=1&rel=0`}
            title={`Video: ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="video-facade" onClick={() => setPlaying(true)}>
            <span className="video-play" aria-hidden="true">▶</span>
            <span>Putar video: {title}</span>
          </button>
        )}
      </div>
    );
  }

  if (externalUrl) {
    return (
      <div className="video-frame video-fallback">
        <p>Video tidak dapat disematkan.</p>
        <a className="text-link" href={externalUrl} target="_blank" rel="noopener noreferrer">
          Buka di platform asli ↗
        </a>
      </div>
    );
  }

  return (
    <div className="video-frame video-fallback">
      <p>Video belum tersedia.</p>
    </div>
  );
}
