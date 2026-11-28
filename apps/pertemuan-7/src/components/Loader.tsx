import { useEffect, useRef, useState } from 'react';
import { playSound, setSoundEnabled } from '../audio/sound';
import { useSound } from '../audio/useSound';
import { profile } from '../data/profile';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { LogoMark } from './LogoMark';
import { PillButton } from './PillButton';

const MIN_LOAD_MS = 1100;
const MARK_MS = 900;
const FLIGHT_MS = 950;

export interface GateLeave {
  /** Pusat logo gate dalam px viewport: bintang keluar dari sini. */
  origin: { x: number; y: number };
}

interface LoaderProps {
  /** Pilihan sudah dibuat: background boleh menyala dan chrome boleh mulai masuk. */
  onLeave: (leave: GateLeave) => void;
  /** Logo sudah mendarat di pojok: gate boleh dibuang. */
  onEntered: () => void;
}

type Phase = 'loading' | 'mark' | 'ready' | 'leaving';

/** Nunggu font dan waktu minimum biar hitungannya selalu kebaca sebagai intro yang disengaja. */
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

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Gate-nya. Background-nya transparan: ASCII wake halaman udah jalan di belakangnya (tanpa bintang).
 * Hitungan sampai 100, berubah jadi logo F, lalu "enter with sound / without sound". Begitu milih, teks dan
 * tombol larut dan F terbang (FLIP) ke logo kiri atas sementara bintang keluar di sekitarnya, jadi gate dan
 * halaman karya berbagi satu background yang nyambung.
 */
export function Loader({ onLeave, onEntered }: LoaderProps) {
  const reducedMotion = useReducedMotion();
  const { supported } = useSound();
  const progress = useLoadProgress(reducedMotion);
  const [phase, setPhase] = useState<Phase>('loading');
  const enterRef = useRef<HTMLButtonElement>(null);
  const markRef = useRef<SVGSVGElement>(null);

  // 100 → hitungan memberi jalan ke logo → pilihan muncul.
  useEffect(() => {
    if (progress >= 100 && phase === 'loading') setPhase('mark');
  }, [progress, phase]);

  useEffect(() => {
    if (phase !== 'mark') return;
    const timer = window.setTimeout(() => setPhase('ready'), reducedMotion ? 0 : MARK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase === 'ready') enterRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const choose = (withSound: boolean) => {
    if (phase !== 'ready') return;
    setSoundEnabled(withSound);
    if (withSound) {
      // Klik langsung menjawab tekanan; chime menyusul pas gate terbuka.
      playSound('click');
      window.setTimeout(() => playSound('enter'), 80);
    }
    setPhase('leaving');

    const mark = markRef.current;
    const target = document.querySelector<HTMLElement>('.logo .logo-mark');
    const from = mark?.getBoundingClientRect();
    onLeave({ origin: from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 } });

    if (!mark || !target || !from || reducedMotion) {
      onEntered();
      return;
    }
    // FLIP: dari box logo gate ke box logo pojok.
    const to = target.getBoundingClientRect();
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const scale = to.width / from.width;
    const flight = mark.animate(
      [
        { transformOrigin: '0 0', transform: 'translate(0, 0) scale(1)' },
        { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      { duration: FLIGHT_MS, easing: cssVar('--ease-spring', 'cubic-bezier(.16, 1, .3, 1)'), fill: 'forwards' },
    );
    flight.finished.then(onEntered, onEntered);
  };

  const showChoice = phase === 'ready';
  const countState = phase === 'loading' ? 'count' : 'gone';

  return (
    <div className="loader" data-phase={phase} role="dialog" aria-modal="true" aria-label="Intro">
      <div className="loader-mark" aria-hidden="true">
        <span className="loader-ring" />
        <span className={`loader-count ${countState}`}>{String(progress).padStart(2, '0')}</span>
        <LogoMark ref={markRef} className="loader-logo" />
      </div>
      <p className="loader-text">
        <span className="line">
          <span>{profile.handle} ✳ showreel</span>
        </span>
        <span className="line">
          <span>{profile.tagline}</span>
        </span>
      </p>
      <PillButton
        ref={enterRef}
        label={supported ? 'enter with sound' : 'enter'}
        className={`loader-enter${showChoice ? ' show' : ''}`}
        tabIndex={showChoice ? 0 : -1}
        aria-hidden={!showChoice}
        onClick={() => choose(supported)}
      />
      {supported ? (
        <button
          type="button"
          className={`loader-silent${showChoice ? ' show' : ''}`}
          tabIndex={showChoice ? 0 : -1}
          aria-hidden={!showChoice}
          onClick={() => choose(false)}
        >
          enter without sound
        </button>
      ) : null}
    </div>
  );
}
