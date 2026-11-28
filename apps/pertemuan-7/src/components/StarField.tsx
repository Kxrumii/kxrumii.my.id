import { memo, useEffect, useRef } from 'react';
import { addPointer, ambientScatter, charFor, createWake, stepWake, WAKE_CELL, type ScatterGlyph } from '../background/asciiWake';
import {
  createShootingStar,
  createStars,
  nextShootingDelayMs,
  regenerateStars,
  STAR_CONFIG,
  stepShootingStars,
  stepTwinkle,
  type BackgroundStar,
  type ShootingStar,
} from '../background/pixelStars';
import { liveRipples, rippleAlpha, rippleBoost, rippleRadius, type Ripple } from '../background/ripple';
import { playSound } from '../audio/sound';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface StarFieldProps {
  /** false: cuma ASCII wake dan sebaran diamnya (gate); true: pixel stars ikut muncul. */
  starsOn: boolean;
  /** Dari mana bintang mulai muncul (px viewport); default tengah. */
  origin?: { x: number; y: number } | null;
}

const MAX_DPR = 2;
const REVEAL_S = 1.5;
const POP_S = 0.25;
const TRAIL_SOUND_MIN = 0.35;
/** Klik di elemen ini nggak pernah bikin ripple (mereka sudah punya fungsi sendiri). */
const INTERACTIVE = 'a, button, input, textarea, select, iframe, [role="button"], .project-card';

/**
 * Canvas background persisten (Canvas 2D, bukan WebGL), di-mount sekali di layout di belakang semuanya:
 * ASCII wake ngikutin pointer di mana-mana; pixel stars muncul menyebar dari `origin` begitu `starsOn`
 * jadi true, dengan shooting star berkala; klik ruang kosong ngirim ripple.
 */
export const StarField = memo(function StarField({ starsOn, origin }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();
  const props = useRef({ starsOn, origin, reducedMotion });
  props.current = { starsOn, origin, reducedMotion };
  const revealStart = useRef<number | null>(null);

  // Tandai saat bintang dinyalakan (reveal berjalan dari situ).
  useEffect(() => {
    if (starsOn && revealStart.current === null) {
      revealStart.current = performance.now() / 1000;
      playSound('stars');
    }
  }, [starsOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let stars: BackgroundStar[] = [];
    let revealDelay: number[] = [];
    let scatter: ScatterGlyph[] = [];
    let shooting: ShootingStar[] = [];
    let ripples: Ripple[] = [];
    const wake = createWake();
    let raf = 0;
    let lastFrame = 0;
    let tickAccumulator = 0;
    let lastRegenerate = performance.now();
    let nextShootingAt = performance.now() + nextShootingDelayMs(Math.random);
    /** Delay reveal diukur dari origin yang diketahui pas bintang dinyalakan. */
    let revealMeasured = false;

    const computeReveal = () => {
      const o = props.current.origin ?? { x: width / 2, y: height / 2 };
      const far = Math.hypot(Math.max(o.x, width - o.x), Math.max(o.y, height - o.y)) || 1;
      revealDelay = stars.map((star) => (Math.hypot(star.x - o.x, star.y - o.y) / far) * REVEAL_S);
      revealMeasured = revealStart.current !== null;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars(width, height, Math.random);
      scatter = ambientScatter(width, height, Math.random);
      computeReveal();
    };

    const draw = (nowMs: number) => {
      raf = 0;
      const nowS = nowMs / 1000;
      const dt = Math.min(Math.max((nowMs - (lastFrame || nowMs)) / 1000, 0), 0.1);
      lastFrame = nowMs;
      const { starsOn: on, reducedMotion: still } = props.current;

      // Tick retro 16 fps buat layer bintang (twinkle dan shooting star), kayak komponen aslinya.
      tickAccumulator += dt;
      const tickS = 1 / STAR_CONFIG.fps;
      let ticks = 0;
      while (tickAccumulator >= tickS && ticks < 4) {
        tickAccumulator -= tickS;
        ticks += 1;
        if (!still) {
          stars.forEach(stepTwinkle);
          shooting = stepShootingStars(shooting, width, height);
        }
      }
      if (on && !still) {
        if (nowMs - lastRegenerate >= STAR_CONFIG.regenerateEveryMs) {
          lastRegenerate = nowMs;
          for (const index of regenerateStars(stars, width, height, Math.random)) revealDelay[index] = 0;
        }
        if (nowMs >= nextShootingAt) {
          shooting.push(createShootingStar(width, Math.random));
          nextShootingAt = nowMs + nextShootingDelayMs(Math.random);
        }
      }
      stepWake(wake, dt, still ? 0.3 : 0.9);
      ripples = liveRipples(ripples, nowS);

      ctx.clearRect(0, 0, width, height);

      ctx.font = `500 ${WAKE_CELL - 3}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fafafa';
      for (const glyph of scatter) {
        ctx.globalAlpha = glyph.alpha;
        ctx.fillText(glyph.char, glyph.x + 3, glyph.y + 2);
      }

      const started = revealStart.current;
      if (started !== null && !revealMeasured) computeReveal();
      if (started !== null) {
        const elapsed = nowS - started;
        const size = STAR_CONFIG.pixelSize;
        stars.forEach((star, i) => {
          const local = still ? 1 : Math.min(Math.max((elapsed - (revealDelay[i] ?? 0)) / POP_S, 0), 1);
          if (local <= 0) return;
          const boost = ripples.length ? rippleBoost(ripples, star.x, star.y, nowS) : 0;
          ctx.globalAlpha = Math.min(1, (still ? star.baseOpacity : star.currentOpacity) * local + boost * 0.6);
          ctx.fillStyle = star.color;
          ctx.fillRect(star.x, star.y, size, size);
        });

        // Shooting star: trail pixel yang diputar dan kepala pixel 4×2 dengan dua pixel hilang.
        const px = STAR_CONFIG.shootingPixelSize;
        for (const star of shooting) {
          const rad = (star.angle * Math.PI) / 180;
          for (const point of star.trail) {
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(rad);
            ctx.globalAlpha = point.opacity;
            ctx.fillStyle = 'rgb(180, 242, 255)';
            ctx.fillRect(0, 0, px, px);
            ctx.restore();
          }
          ctx.save();
          ctx.translate(star.x, star.y);
          ctx.rotate(rad);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffffff';
          for (let y = 0; y < 2; y += 1) {
            for (let x = 0; x < 4; x += 1) {
              if ((x === 0 && y === 1) || (x === 3 && y === 0)) continue;
              ctx.fillRect(x * px, y * px, px, px);
            }
          }
          ctx.restore();
        }
      }

      // Ring ripple digambar sebagai pixel di grid bintang.
      for (const ripple of ripples) {
        const radius = rippleRadius(ripple, nowS);
        const alpha = rippleAlpha(ripple, nowS);
        const count = Math.max(12, Math.floor((2 * Math.PI * radius) / 14));
        ctx.fillStyle = '#21ffc0';
        ctx.globalAlpha = alpha * 0.7;
        for (let k = 0; k < count; k += 1) {
          const a = (k / count) * Math.PI * 2;
          const x = Math.round((ripple.x + Math.cos(a) * radius) / 5) * 5;
          const y = Math.round((ripple.y + Math.sin(a) * radius) / 5) * 5;
          ctx.fillRect(x, y, 3, 3);
        }
      }

      // ASCII wake: sel paling terang menyala mint.
      for (const cell of wake.cells.values()) {
        ctx.globalAlpha = Math.min(1, cell.energy * 0.9);
        ctx.fillStyle = cell.energy > 0.8 ? '#21ffc0' : '#fafafa';
        ctx.fillText(charFor(cell.energy), cell.col * WAKE_CELL + 3, cell.row * WAKE_CELL + 2);
      }
      ctx.globalAlpha = 1;

      if (document.visibilityState === 'visible') raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!raf && document.visibilityState === 'visible') {
        lastFrame = 0;
        raf = requestAnimationFrame(draw);
      }
    };

    const onMove = (event: PointerEvent) => {
      const factor = addPointer(wake, event.clientX, event.clientY, event.timeStamp);
      if (factor >= TRAIL_SOUND_MIN) playSound('trail', factor);
    };
    const onDown = (event: PointerEvent) => {
      if (props.current.reducedMotion || event.button !== 0) return;
      const target = event.target as Element | null;
      if (target?.closest?.(INTERACTIVE)) return;
      ripples.push({ x: event.clientX, y: event.clientY, bornS: performance.now() / 1000 });
      playSound('ripple');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onResize = () => resize();

    resize();
    start();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
});
