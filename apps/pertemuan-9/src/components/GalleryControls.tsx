import { useSound } from '../audio/useSound';

interface GalleryControlsProps {
  /** Manual pause is on. */
  paused: boolean;
  /** Reduced motion: the camera is static, so there is no autoplay to pause. */
  reducedMotion: boolean;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
}

/** Previous / Pause-Play / Next. Always visible and keyboard operable (touch and keyboard users cannot hover to pause). */
export function GalleryControls({ paused, reducedMotion, disabled, onPrev, onNext, onTogglePause }: GalleryControlsProps) {
  const { play } = useSound();

  return (
    <div className="gallery-controls" role="group" aria-label="Kontrol galeri">
      <button
        type="button"
        className="gallery-button"
        aria-label="Karya sebelumnya"
        disabled={disabled}
        onClick={() => {
          play('click');
          onPrev();
        }}
      >
        ←
      </button>
      {reducedMotion ? null : (
        <button
          type="button"
          className="gallery-button gallery-button-pause"
          aria-pressed={paused}
          aria-label="Jeda gerak otomatis"
          disabled={disabled}
          onClick={() => {
            play('click');
            onTogglePause();
          }}
        >
          {paused ? '▶' : '❚❚'}
        </button>
      )}
      <button
        type="button"
        className="gallery-button"
        aria-label="Karya berikutnya"
        disabled={disabled}
        onClick={() => {
          play('click');
          onNext();
        }}
      >
        →
      </button>
    </div>
  );
}
