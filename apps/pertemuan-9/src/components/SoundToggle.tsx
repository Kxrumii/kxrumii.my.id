import { useSound } from '../audio/useSound';

interface SoundToggleProps {
  /** `text`: "SFX On —" in the top bar. `round`: floating button (mobile). */
  variant: 'text' | 'round';
  className?: string;
}

/**
 * Global sound-effects switch (owner decision): the same state as the SFX toggle in the gallery HUD. Music has its
 * own switch in the HUD only, because the soundtrack only exists in the gallery. The state is exposed through
 * aria-pressed; the accessible name stays constant.
 */
export function SoundToggle({ variant, className }: SoundToggleProps) {
  const { supported, sfxEnabled, toggleSfx, play } = useSound();

  function handleClick() {
    toggleSfx();
    if (!sfxEnabled) play('click');
  }

  if (variant === 'round') {
    return (
      <button
        type="button"
        className={['sound-round', className].filter(Boolean).join(' ')}
        aria-label="Efek suara"
        aria-pressed={sfxEnabled}
        disabled={!supported}
        onClick={handleClick}
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
    );
  }

  return (
    <button
      type="button"
      className={['sound-text', className].filter(Boolean).join(' ')}
      aria-label="Efek suara"
      aria-pressed={sfxEnabled}
      disabled={!supported}
      onClick={handleClick}
    >
      <span className="ui-label">SFX</span>
      <span aria-hidden="true">{supported ? (sfxEnabled ? 'On' : 'Off') : 'Tidak didukung'}</span>
      <span className="sound-dash" aria-hidden="true" data-on={sfxEnabled ? 'true' : undefined} />
    </button>
  );
}
