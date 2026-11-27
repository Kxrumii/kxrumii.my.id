import { useEffect, useRef, useState } from 'react';
import { playSound, setSoundEnabled } from '../audio/sound';
import { useSound } from '../audio/useSound';
import { profile } from '../data/profile';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PillButton } from './PillButton';

const MIN_LOAD_MS = 1100;
const LEAVE_MS = 520;

interface LoaderProps {
  /** Called once the panel has fully left. */
  onEntered: () => void;
}

type Phase = 'loading' | 'ready' | 'leaving';

/** Waits for fonts and a minimum time so the count always reads as a deliberate intro. */
function useLoadProgress(reducedMotion: boolean): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    let fontsDone = !document.fonts;
    void document.fonts?.ready.then(() => {
      fontsDone = true;
    });
    const start = performance.now();
    const minMs = reducedMotion ? 0 : MIN_LOAD_MS;
    const tick = (now: number) => {
      const t = minMs === 0 ? 1 : Math.min((now - start) / minMs, 1);
      // Ease-out count that waits at 99 until the fonts are in.
      const eased = 1 - Math.pow(1 - t, 3);
      const value = fontsDone ? Math.round(eased * 100) : Math.min(Math.round(eased * 100), 99);
      setProgress(value);
      if (value < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);
  return progress;
}

/**
 * Full-screen intro: a counter, a short statement, then the choice "enter with sound" / "enter without
 * sound". The choice is the user gesture that may start audio. The panel then lifts away.
 */
export function Loader({ onEntered }: LoaderProps) {
  const reducedMotion = useReducedMotion();
  const { supported } = useSound();
  const progress = useLoadProgress(reducedMotion);
  const [phase, setPhase] = useState<Phase>('loading');
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (progress >= 100 && phase === 'loading') setPhase('ready');
  }, [progress, phase]);

  useEffect(() => {
    if (phase === 'ready') enterRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(onEntered, reducedMotion ? 0 : LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, onEntered]);

  const choose = (withSound: boolean) => {
    if (phase !== 'ready') return;
    setSoundEnabled(withSound);
    if (withSound) playSound('enter');
    setPhase('leaving');
  };

  const ready = phase !== 'loading';

  return (
    <div className="loader" data-phase={phase} role="dialog" aria-modal="true" aria-label="Intro">
      <div className="loader-mark" aria-hidden="true">
        <span className="loader-ring" />
        <span className="loader-count">{String(progress).padStart(2, '0')}</span>
      </div>
      <p className="loader-text">
        <span className="line">
          <span>{profile.handle} ✳ portfolio</span>
        </span>
        <span className="line">
          <span>{profile.tagline}</span>
        </span>
      </p>
      <PillButton
        ref={enterRef}
        label={supported ? 'enter with sound' : 'enter'}
        className={`loader-enter${ready ? ' show' : ''}`}
        tabIndex={ready ? 0 : -1}
        aria-hidden={!ready}
        onClick={() => choose(supported)}
      />
      {supported ? (
        <button
          type="button"
          className={`loader-silent${ready ? ' show' : ''}`}
          tabIndex={ready ? 0 : -1}
          aria-hidden={!ready}
          onClick={() => choose(false)}
        >
          enter without sound
        </button>
      ) : null}
    </div>
  );
}
