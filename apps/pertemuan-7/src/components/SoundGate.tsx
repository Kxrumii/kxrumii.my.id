import { useEffect, useRef } from 'react';
import { getStoredPreference } from '../audio/soundEngine';
import { profile } from '../data/profile';
import { transitionIndex } from '../transition';

interface SoundGateProps {
  /** Called from the button's click handler, so audio may start inside the gesture. */
  onChoose: (withSound: boolean) => void;
  leaving: boolean;
}

/** Entry gate shown once per session (Pacôme flow): choose to enter with or without sound. */
export function SoundGate({ onChoose, leaving }: SoundGateProps) {
  const withSoundRef = useRef<HTMLButtonElement>(null);
  const withoutSoundRef = useRef<HTMLButtonElement>(null);

  // Focus the option chosen last time on this device (default: with sound).
  useEffect(() => {
    const target = getStoredPreference() === 'off' ? withoutSoundRef : withSoundRef;
    target.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="gate" aria-labelledby="gate-title" data-gate-part="">
      <div className="gate-inner">
        <svg
          className="gate-mark"
          data-gate-part=""
          data-transition-exit=""
          data-transition-enter=""
          style={transitionIndex(0)}
          viewBox="0 0 96 64"
          aria-hidden="true"
        >
          {/* A film frame reduced to its corner marks and two sprocket ticks: the "first frame" before the room opens. */}
          <path d="M2 18V2h16M78 2h16v16M94 46v16H78M18 62H2V46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M44 8h8M44 56h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
        <p className="ui-label gate-timecode" data-gate-part="" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)} aria-hidden="true">
          TC 00:00:00:00
        </p>
        <div data-gate-part="" data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
          <p className="ui-label">PAW / Pertemuan 07</p>
          <h1 id="gate-title" className="gate-title">Kxrumii</h1>
          <p className="gate-tagline">{profile.tagline}</p>
        </div>
        <div className="gate-actions" data-gate-part="" data-transition-exit="" data-transition-enter="" style={transitionIndex(2)}>
          <button ref={withSoundRef} type="button" className="gate-button" disabled={leaving} onClick={() => onChoose(true)}>
            Masuk dengan suara
          </button>
          <button
            ref={withoutSoundRef}
            type="button"
            className="gate-button gate-button-quiet"
            disabled={leaving}
            onClick={() => onChoose(false)}
          >
            Masuk tanpa suara
          </button>
        </div>
        <p className="gate-hint ui-label" data-gate-part="" data-transition-exit="" data-transition-enter="" style={transitionIndex(3)}>
          Musik dan efek suara dapat diubah kapan saja.
        </p>
      </div>
    </section>
  );
}
