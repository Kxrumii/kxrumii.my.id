import { useSound } from '../audio/useSound';

interface SoundToggleProps {
  /** `text`: Huy-style "Audio Off —" in the top bar. `round`: Pacôme-style floating button. */
  variant: 'text' | 'round';
  className?: string;
}

/** Sound on/off. The accessible name stays "Audio"; the state is exposed through aria-pressed. */
export function SoundToggle({ variant, className }: SoundToggleProps) {
  const { supported, enabled, toggle, play } = useSound();

  function handleClick() {
    toggle();
    if (!enabled) play('click');
  }

  if (variant === 'round') {
    return (
      <button
        type="button"
        className={['sound-round', className].filter(Boolean).join(' ')}
        aria-label="Audio"
        aria-pressed={enabled}
        disabled={!supported}
        onClick={handleClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {enabled ? (
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
      aria-label="Audio"
      aria-pressed={enabled}
      disabled={!supported}
      onClick={handleClick}
    >
      <span className="ui-label">Audio</span>
      <span aria-hidden="true">{supported ? (enabled ? 'On' : 'Off') : 'Tidak didukung'}</span>
      <span className="sound-dash" aria-hidden="true" data-on={enabled ? 'true' : undefined} />
    </button>
  );
}
