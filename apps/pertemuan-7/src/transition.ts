/*
 * Instalasi Shared Transition Bridge buat Task 7 (portfolio).
 * Dipasang sekali pas module di-init (sebelum React render); kesiapan halaman dikasih sinyal lewat
 * usePageReady() tiap route commit.
 *
 * Canvas: app-nya satu kanvas hampir hitam (#0a0a0a), sama dengan `canvasFallback` Portal buat task-7,
 * jadi nggak ada warna serah-terima.
 *
 * Scope: pergantian route di dokumen yang sama jalan dengan `data-route-scope="stage"`, jadi cuma isi halaman
 * yang bergerak sementara chrome tetap (`[data-shell]`) diam. Navigasi dokumen (ke/dari Portal) menganimasikan semuanya.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import { installTransitionBridge, publishCanvasColor, transitionEvents, type ExitEnterContext, type TransitionBridge } from '@kxrumii/transition-bridge';
import { useCallback, useEffect, type CSSProperties } from 'react';
import { useNavigate, type To } from 'react-router';

export const PAGE_ID = 'task-7';
/** Harus tetap sama dengan `canvasFallback` Portal buat task-7 dan `--color-bg-dark`. */
export const CANVAS = '#0a0a0a';

/** Portal tugas (dokumen Astro di luar app ini) dan warna canvas cadangannya, sama dengan link balik P1/P6/P8. */
export const PORTAL_HREF = '/tugas/';
export const CANVAS_PORTAL = '#0b0b0b';

const root = document.documentElement;

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

function participants(elements: HTMLElement[]): HTMLElement[] {
  if (root.dataset.routeScope === 'stage') return elements.filter((el) => el.closest('[data-shell]') === null);
  return elements;
}

export type RouteDirection = 'next' | 'prev';

/*
 * Gerak halaman mengikuti referensi (transisi `project` / `project-fade`-nya), pakai WAAPI, bukan wipe clip-path
 * bridge yang kelihatan kayak kedip:
 *   default  exit: fade + settle ke scale(.985)          enter: naik 80 px dari scale(.96)
 *   next     exit: melayang ke atas dan mengecil         enter: naik dari bawah
 *   prev     exit: melayang ke bawah dan mengecil        enter: turun dari atas
 * Enter mulai hampir langsung, jadi nggak ada frame kosong di antara dua halaman (star field tetap).
 */
const EXIT_FRAMES: Record<RouteDirection | 'default', Keyframe[]> = {
  default: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.985)' }],
  next: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -48px, 0) scale(0.96)' }],
  prev: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 48px, 0) scale(0.96)' }],
};
const ENTER_FROM: Record<RouteDirection | 'default', string> = {
  default: 'translate3d(0, 80px, 0) scale(0.96)',
  next: 'translate3d(0, 80px, 0) scale(0.96)',
  prev: 'translate3d(0, -80px, 0) scale(0.96)',
};
const SPRING_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

function direction(): RouteDirection | 'default' {
  const dir = root.dataset.routeDir;
  return dir === 'next' || dir === 'prev' ? dir : 'default';
}

async function run(ctx: ExitEnterContext, kind: 'exit' | 'enter'): Promise<void> {
  const dir = direction();
  const elements = participants(ctx.elements);
  const animations = elements.map((el, i) => {
    const index = Number.parseFloat(getComputedStyle(el).getPropertyValue('--i')) || i;
    if (kind === 'exit') {
      return el.animate(EXIT_FRAMES[dir], {
        duration: dir === 'default' ? 450 : 380,
        delay: Math.min(index, 3) * 30,
        easing: dir === 'default' ? 'ease' : 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      });
    }
    return el.animate([{ opacity: 0, transform: ENTER_FROM[dir] }, { opacity: 1, transform: 'none' }], {
      duration: 650,
      delay: (dir === 'default' ? 120 : 40) + Math.min(index, 3) * 60,
      easing: SPRING_OUT,
      fill: 'both',
    });
  });
  if (kind === 'enter') finishedEnters.push(...animations);
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

/*
 * Animasi enter menahan state akhirnya (fill: both) sampai bridge keluar dari state `entering`; baru setelah itu
 * dibuang, jadi aturan pre-state opacity nggak pernah kebagian frame buat menyembunyikan halaman baru.
 */
const finishedEnters: Animation[] = [];

// Dijaga biar module yang dievaluasi ulang (HMR dev) nggak memasang bridge kedua.
export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: PAGE_ID,
  pageCanvasColor: CANVAS,
  exit: (ctx) => run(ctx, 'exit'),
  enter: (ctx) => run(ctx, 'enter'),
}));

document.addEventListener(transitionEvents.transition, (event) => {
  const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
  if (phase === 'enter-end' || phase === 'recovered') {
    delete root.dataset.routeScope;
    delete root.dataset.routeDir;
    requestAnimationFrame(() => finishedEnters.splice(0).forEach((animation) => animation.cancel()));
    publishCanvasColor(PAGE_ID, CANVAS);
  }
});

/** Resolve begitu nggak ada transisi yang jalan (bridge nolak navigasi baru selama masih sibuk). */
export function whenTransitionIdle(timeoutMs = 2500): Promise<void> {
  if (!root.dataset.transitionState) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener(transitionEvents.transition, onPhase);
      window.clearTimeout(timer);
      // Kasih satu frame biar bridge selesai beres-beres (busy = false) sebelum klik berikutnya.
      requestAnimationFrame(() => resolve());
    };
    const onPhase = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
      if (phase === 'enter-end' || phase === 'recovered') done();
    };
    const timer = window.setTimeout(done, timeoutMs);
    document.addEventListener(transitionEvents.transition, onPhase);
  });
}

/** Tandai page-ready setelah route commit. Idempoten, jadi double effect StrictMode aman. */
export function usePageReady(routeKey?: string): void {
  useEffect(() => {
    bridge.markPageReady();
  }, [routeKey]);
}

/** Index stagger buat elemen yang ikut transisi route. */
export function transitionIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/*
 * BrowserRouter membungkus navigasi di startTransition, jadi navigate() balik sebelum route baru commit.
 * transitionTo() milik bridge mengharapkan update() resolve begitu DOM tujuan ada, jadi layout melaporkan
 * tiap commit lewat notifyRouteCommit().
 */
let resolveRouteCommit: (() => void) | null = null;

function nextRouteCommit(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolveRouteCommit = null;
      resolve(false);
    }, timeoutMs);
    resolveRouteCommit = () => {
      window.clearTimeout(timer);
      resolveRouteCommit = null;
      resolve(true);
    };
  });
}

/** Dipanggil layout dari layout effect, tepat setelah route commit. */
export function notifyRouteCommit(): void {
  resolveRouteCommit?.();
}

/**
 * Navigasi dengan transisi exit → swap → enter yang di-scope ke stage. `dir` ngasih arah gerak (karya
 * berikut/sebelumnya). Resolve ke false kalau sudah ada yang jalan.
 */
export function useTransitionNavigate(): (to: To, options?: { dir?: RouteDirection }) => Promise<boolean> {
  const navigate = useNavigate();
  return useCallback(
    async (to: To, options?: { dir?: RouteDirection }) => {
      if (root.dataset.transitionState) return false;
      root.dataset.routeScope = 'stage';
      if (options?.dir) root.dataset.routeDir = options.dir;
      else delete root.dataset.routeDir;
      const started = await bridge.transitionTo(
        async () => {
          const committed = nextRouteCommit(1500);
          navigate(to);
          await committed;
        },
        { canvasColor: CANVAS },
      );
      if (!started) {
        delete root.dataset.routeScope;
        delete root.dataset.routeDir;
      }
      publishCanvasColor(PAGE_ID, CANVAS);
      return started;
    },
    [navigate],
  );
}
