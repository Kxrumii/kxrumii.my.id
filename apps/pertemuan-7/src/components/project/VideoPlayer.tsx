import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { playSound, setMusicDucked } from '../../audio/sound';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { command, embedUrl, INITIAL_SNAPSHOT, listening, parseMessage, playedFraction, reduce, seekTarget, type Command, type PlayerSnapshot } from '../../video/youtubeBridge';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  poster: string | null;
  /** Lebar / tinggi video: frame disesuaikan, jadi nggak ada letterbox yang nutupin poster blur. */
  aspect: number;
  /** Empat still buat scrubber, urut waktu. */
  thumbs: string[];
  onClose: () => void;
}

const EXIT_MS = 400;
const IDLE_MS = 2600;
const SEEK_STEP_S = 5;

/**
 * Player layar penuh mengikuti referensi: poster blur di belakang, video contain di tengah, dan pill putih
 * kontrol di bawah (play/pause, mute, scrubber dari empat still, close). Videonya embed YouTube tanpa kontrol
 * sendiri, dikendalikan lewat postMessage (lihat video/youtubeBridge.ts).
 * Tombol: Space/K play-pause, M mute, ←/→ ±5 s, Esc close. Musik dibisukan selama player kebuka.
 */
export function VideoPlayer({ videoId, title, poster, aspect, thumbs, onClose }: VideoPlayerProps) {
  const reducedMotion = useReducedMotion();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(INITIAL_SNAPSHOT);
  const [closing, setClosing] = useState(false);
  const [idle, setIdle] = useState(false);
  const display = useRef(0);
  const progressRef = useRef<HTMLSpanElement>(null);
  const anchor = useRef({ time: 0, at: 0 });
  const idleTimer = useRef(0);

  const send = useCallback((func: Command, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(command(func, args), 'https://www.youtube-nocookie.com');
  }, []);

  const close = useCallback(() => {
    if (closing) return;
    playSound('close');
    send('pauseVideo');
    setClosing(true);
    window.setTimeout(onClose, reducedMotion ? 0 : EXIT_MS);
  }, [closing, onClose, reducedMotion, send]);

  // Buka: kunci scroll halaman, bisukan musik, tandai dokumen (edge navigation berhenti), fokus ke kontrol.
  useEffect(() => {
    const root = document.documentElement;
    const opener = document.activeElement as HTMLElement | null;
    root.dataset.player = 'open';
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    setMusicDucked(true);
    playRef.current?.focus({ preventScroll: true });
    return () => {
      delete root.dataset.player;
      root.style.overflow = overflow;
      setMusicDucked(false);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  // Pesan dari embed, plus handshake "listening" sampai dia menjawab.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parseMessage(event.origin, event.data);
      if (!message) return;
      setSnapshot((current) => {
        const next = reduce(current, message);
        // Caption otomatis jangan nutupin gambar: dimatiin pas ready dan sekali lagi pas playback mulai
        // (YouTube memuat modul caption belakangan).
        if ((next.ready && !current.ready) || (next.playing && !current.playing)) {
          send('unloadModule', ['captions']);
        }
        if (next.currentTime !== current.currentTime) anchor.current = { time: next.currentTime, at: performance.now() };
        return next;
      });
    };
    window.addEventListener('message', onMessage);
    const handshake = window.setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(listening(), 'https://www.youtube-nocookie.com');
    }, 300);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(handshake);
    };
  }, [send]);

  // Progress halus di antara laporan waktu embed yang kasar, ditulis langsung ke overlay scrubber.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = snapshot.playing ? (performance.now() - anchor.current.at) / 1000 : 0;
      display.current = Math.min(anchor.current.time + elapsed, snapshot.duration || Infinity);
      const fraction = playedFraction({ currentTime: display.current, duration: snapshot.duration });
      progressRef.current?.style.setProperty('--remaining', (1 - fraction).toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapshot.playing, snapshot.duration]);

  // Kontrol memudar selagi video main dan pointer diam.
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [wake]);

  const togglePlay = useCallback(() => {
    playSound('click');
    send(snapshot.playing ? 'pauseVideo' : 'playVideo');
  }, [send, snapshot.playing]);
  const toggleMute = useCallback(() => {
    playSound('click');
    send(snapshot.muted ? 'unMute' : 'mute');
    setSnapshot((s) => ({ ...s, muted: !s.muted }));
  }, [send, snapshot.muted]);
  const seek = useCallback(
    (seconds: number) => {
      const target = Math.min(Math.max(seconds, 0), snapshot.duration || seconds);
      anchor.current = { time: target, at: performance.now() };
      send('seekTo', [target, true]);
    },
    [send, snapshot.duration],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      wake();
      if (event.key === 'Escape') close();
      else if (event.key === ' ' || event.key === 'k' || event.key === 'K') {
        if ((event.target as HTMLElement | null)?.closest('button')) return;
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'm' || event.key === 'M') toggleMute();
      else if (event.key === 'ArrowRight') seek(display.current + SEEK_STEP_S);
      else if (event.key === 'ArrowLeft') seek(display.current - SEEK_STEP_S);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, seek, toggleMute, togglePlay, wake]);

  const scrubTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = scrubRef.current?.getBoundingClientRect();
    if (!box) return;
    seek(seekTarget(event.clientX, box.left, box.width, snapshot.duration));
  };

  const reported = snapshot.currentTime;
  const state = closing ? 'closing' : 'open';

  return createPortal(
    <div
      className="player"
      data-state={state}
      data-idle={idle && snapshot.playing ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — video`}
      style={{ '--aspect': String(aspect), ...(poster ? { '--poster': `url("${poster}")` } : {}) } as CSSProperties}
      onPointerMove={wake}
      // Event React bubble lewat portal: klik di player jangan sampai ke preview yang membukanya.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="player-video">
        <div className="player-frame">
        <iframe
          ref={iframeRef}
          src={embedUrl(videoId, window.location.origin)}
          title={`${title} — video`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {/* Nangkep input pointer biar overlay hover bawaan YouTube tetap tersembunyi; klik toggle playback. */}
        <button type="button" className="player-shield" tabIndex={-1} aria-hidden="true" onClick={togglePlay} />
        </div>
      </div>
      <div className="player-controls">
        <div className="player-inner">
          <button ref={playRef} type="button" className="player-button" aria-label={snapshot.playing ? 'pause' : 'play'} onClick={togglePlay}>
            <span className="player-button-bg" aria-hidden="true" />
            {snapshot.playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
                <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button type="button" className="player-button" aria-label={snapshot.muted ? 'unmute' : 'mute'} aria-pressed={snapshot.muted} onClick={toggleMute}>
            <span className="player-button-bg" aria-hidden="true" />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
              {snapshot.muted ? (
                <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M15.5 9a4.5 4.5 0 0 1 0 6M17.8 6.6a8 8 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              )}
            </svg>
          </button>
          <div
            ref={scrubRef}
            className="player-thumbs"
            role="slider"
            tabIndex={0}
            aria-label="seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(snapshot.duration)}
            aria-valuenow={Math.round(reported)}
            aria-valuetext={`${Math.floor(reported / 60)}:${String(Math.floor(reported % 60)).padStart(2, '0')}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              scrubTo(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubTo(event);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') event.stopPropagation();
              if (event.key === 'ArrowRight') seek(display.current + SEEK_STEP_S);
              if (event.key === 'ArrowLeft') seek(display.current - SEEK_STEP_S);
            }}
          >
            {thumbs.map((src, i) => (
              <span key={i} className="player-thumb">
                <img src={src} alt="" draggable={false} />
              </span>
            ))}
            <span ref={progressRef} className="player-progress" aria-hidden="true" />
          </div>
          <button type="button" className="player-close" aria-label="close video" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
