import { playSound, toggleSound } from '../audio/sound';
import { useSound } from '../audio/useSound';

/** Bottom-right round sound switch; the bars move while sound is on. */
export function SoundButton() {
  const { supported, enabled } = useSound();
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`sound-button${enabled ? ' on' : ''}`}
      aria-pressed={enabled}
      aria-label={enabled ? 'sound on' : 'sound off'}
      onPointerEnter={() => playSound('hover')}
      onClick={() => {
        toggleSound();
        playSound('click');
      }}
    >
      <span className="sound-bg" aria-hidden="true" />
      <span className="sound-bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
