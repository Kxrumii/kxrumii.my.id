import { useEffect, useRef } from 'react';
import { playSound } from '../audio/sound';
import { useTransitionNavigate, type RouteDirection } from '../transition';
import { accumulate, DRAIN_DELAY_MS, drain, edgeIntent, edgeOf, edgeReady, isComplete, normalizeWheel, type Edge } from '../utils/nextProgress';

const KEY_STEP_PX = 140;
const TOUCH_GAIN = 1.6;

interface EdgeNavigationOptions {
  /** Route karya berikut / sebelumnya (null = nggak ada). */
  next: string | null;
  prev: string | null;
}

/**
 * "Keep scrolling" antar karya: lewat bawah, wheel / touch / ↓ PageDown Space ngisi bar next; lewat atas,
 * ↑ PageUp (atau scroll ke atas) ngisi bar previous. Penuh → tetangganya kebuka dengan transisi berarah.
 * Bar surut kalau input berhenti. Input diabaikan sesaat setelah tiba dan sampai viewport diam di tepi, biar
 * momentum trackpad nggak merantai halaman; dan juga selama video player kebuka.
 * Bar ditulis langsung ke DOM (refs), jadi nggak re-render tiap wheel event.
 */
export function useEdgeNavigation({ next, prev }: EdgeNavigationOptions) {
  const navigate = useTransitionNavigate();
  const nextFill = useRef<HTMLSpanElement | null>(null);
  const prevFill = useRef<HTMLSpanElement | null>(null);
  const prevHint = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const progress = { next: 0, prev: 0 };
    const arrivedAt = performance.now();
    let edge: Edge = null;
    let edgeSince: number | null = null;
    let lastInput = 0;
    let raf = 0;
    let lastFrame = 0;
    let done = false;
    let touchY: number | null = null;

    const readEdge = () => {
      const now = edgeOf(window.scrollY, window.innerHeight, document.documentElement.scrollHeight);
      if (now !== edge) {
        edge = now;
        edgeSince = now === null ? null : performance.now();
      }
    };
    const render = () => {
      nextFill.current?.style.setProperty('--progress', progress.next.toFixed(4));
      prevFill.current?.style.setProperty('--progress', progress.prev.toFixed(4));
      if (prevHint.current) prevHint.current.dataset.active = progress.prev > 0.02 ? 'true' : 'false';
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
      lastFrame = now;
      if (now - lastInput > DRAIN_DELAY_MS) {
        progress.next = drain(progress.next, dt);
        progress.prev = drain(progress.prev, dt);
      }
      render();
      if ((progress.next > 0 || progress.prev > 0) && !done) raf = requestAnimationFrame(frame);
      else lastFrame = 0;
    };
    const go = (dir: RouteDirection) => {
      const href = dir === 'next' ? next : prev;
      if (!href) return;
      done = true;
      playSound('next');
      void navigate(href, { dir });
    };
    const push = (deltaPx: number) => {
      if (done || root.dataset.player === 'open') return;
      readEdge();
      const now = performance.now();
      const intent = edgeIntent(edge, deltaPx);
      if (intent === null) {
        // Scroll balik menjauh dari tepi ngosongin bar tepi itu.
        if (deltaPx < 0 && progress.next > 0) progress.next = accumulate(progress.next, deltaPx);
        if (deltaPx > 0 && progress.prev > 0) progress.prev = accumulate(progress.prev, -deltaPx);
      } else {
        if (!edgeReady(now, arrivedAt, edgeSince) || (intent === 'next' ? !next : !prev)) return;
        const other = intent === 'next' ? 'prev' : 'next';
        progress[other] = 0;
        progress[intent] = accumulate(progress[intent], Math.abs(deltaPx));
        lastInput = now;
        if (isComplete(progress[intent])) {
          render();
          go(intent);
          return;
        }
      }
      render();
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onWheel = (event: WheelEvent) => push(normalizeWheel(event.deltaY, event.deltaMode, window.innerHeight));
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      push((touchY - y) * TOUCH_GAIN);
      touchY = y;
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const onControl = Boolean(target?.closest('button, a'));
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey && !onControl)) push(KEY_STEP_PX);
      else if (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey && !onControl)) push(-KEY_STEP_PX);
    };

    readEdge();
    window.addEventListener('scroll', readEdge, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', readEdge);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [next, prev, navigate]);

  return { nextFill, prevFill, prevHint };
}
