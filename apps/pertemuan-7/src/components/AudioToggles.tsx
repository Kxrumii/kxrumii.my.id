import { useId } from 'react';
import { useSound } from '../audio/useSound';
import type { MusicStatus } from '../audio/soundEngine';

const MUSIC_STATUS: Readonly<Record<MusicStatus, string>> = {
  off: 'Musik mati',
  loading: 'Musik sedang dimuat',
  ready: 'Musik menyala',
  unavailable: 'Lagu belum tersedia; musik diganti suasana latar',
  error: 'Lagu gagal dimuat; musik diganti suasana latar',
};

/**
 * Gallery HUD: two independent switches, Music and SFX. Neither changes the other, and neither touches the camera:
 * Music OFF only moves the master timeline to its silent clock. There is deliberately no track selector.
 */
export function AudioToggles() {
  const { supported, musicEnabled, sfxEnabled, musicStatus, toggleMusic, toggleSfx, play } = useSound();
  const statusId = useId();

  return (
    <div className="audio-toggles" role="group" aria-label="Audio">
      <button
        type="button"
        className="audio-toggle"
        aria-label="Musik"
        aria-pressed={musicEnabled}
        aria-describedby={statusId}
        disabled={!supported}
        data-status={musicStatus}
        onClick={() => {
          toggleMusic();
          play('click');
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" />
          <circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" />
          {musicEnabled ? null : <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
        </svg>
      </button>
      <button
        type="button"
        className="audio-toggle"
        aria-label="Efek suara"
        aria-pressed={sfxEnabled}
        disabled={!supported}
        onClick={() => {
          toggleSfx();
          if (!sfxEnabled) play('click');
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {sfxEnabled ? (
            <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          ) : (
            <path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <span id={statusId} className="visually-hidden" role="status">
        {supported ? MUSIC_STATUS[musicStatus] : 'Audio tidak didukung browser ini'}
      </span>
    </div>
  );
}
