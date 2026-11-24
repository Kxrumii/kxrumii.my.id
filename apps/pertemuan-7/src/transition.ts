/*
 * Shared Transition Bridge installation for Task 7.
 * Installation happens once at module initialisation (before React renders);
 * page readiness is signalled by usePageReady() after the shell commits.
 *
 * Canvas: every document lands on LANDING_CANVAS (what the Portal predicts),
 * then revealCanvas() hands the page off to LIGHT_CANVAS, Huy-style. The
 * published colour for `task-7` is always kept at LANDING_CANVAS.
 *
 * Scopes: same-document route changes run with `data-route-scope="stage"`, so
 * only the stage moves while the shell (`[data-shell]`) stays put. Document
 * navigations (to/from the Portal) animate everything.
 */
import '@kxrumii/transition-bridge/transition-bridge.css';
import {
  animateElements,
  installTransitionBridge,
  publishCanvasColor,
  transitionEvents,
  type ExitEnterContext,
  type TransitionBridge,
} from '@kxrumii/transition-bridge';
import { useCallback, useEffect, type CSSProperties } from 'react';
import { useNavigate, type To } from 'react-router';
import { prefersReducedMotion } from './hooks/useReducedMotion';

export const PAGE_ID = 'task-7';
/** Landing colour; must stay equal to the Portal's `canvasFallback` for task-7. */
export const LANDING_CANVAS = '#10110f';
export const LIGHT_CANVAS = '#ececec';
const REVEAL_MS = 640;

const root = document.documentElement;

declare global {
  interface Window {
    __kxrumiiTransitionBridge?: TransitionBridge;
  }
}

const isShell = (el: HTMLElement) => el.closest('[data-shell]') !== null;
const isGatePart = (el: HTMLElement) => el.closest('[data-gate-part]') !== null;

/** Which elements take part in the current exit/enter. */
function participants(elements: HTMLElement[]): HTMLElement[] {
  if (root.dataset.gate) return elements.filter(isGatePart);
  if (root.dataset.routeScope === 'stage') return elements.filter((el) => !isShell(el));
  return elements;
}

/*
 * "Depth" motion: regions holding a CSS 3D scene (the Works spiral) move with
 * opacity + transform instead of the bridge's clip-path, so no clip ever sits
 * on top of the 3D chain. Everything else uses the bridge's own keyframes.
 */
const DEPTH = '[data-transition-motion="depth"]';

function easingVar(name: string, fallback: string): string {
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
}

function depthAnimations(elements: HTMLElement[], kind: 'exit' | 'enter'): Animation[] {
  return elements.map((el) => {
    const index = Number.parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0;
    if (kind === 'exit') {
      return el.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translate3d(0, -2vh, 0) scale(0.96)' },
        ],
        { duration: 260, delay: index * 30, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
      );
    }
    return el.animate(
      [
        { opacity: 0, transform: 'scale(1.03)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 560, delay: 80 + index * 30, easing: easingVar('--ease-spring', 'cubic-bezier(0.16, 1, 0.3, 1)'), fill: 'both' },
    );
  });
}

/** Animates page elements, routing 3D regions to the depth motion. */
export function animatePageElements(
  elements: HTMLElement[],
  kind: 'exit' | 'enter',
  animateDefault: (els: Iterable<HTMLElement>, kind: 'exit' | 'enter') => Animation[] = animateElements,
): { all: Animation[]; own: Animation[] } {
  const depth = elements.filter((el) => el.matches(DEPTH));
  const rest = elements.filter((el) => !el.matches(DEPTH));
  const own = depthAnimations(depth, kind);
  return { all: [...animateDefault(rest, kind), ...own], own };
}

async function animateParticipants(ctx: ExitEnterContext, kind: 'exit' | 'enter'): Promise<void> {
  const { all, own } = animatePageElements(participants(ctx.elements), kind, ctx.animateElements);
  await Promise.allSettled(all.map((animation) => animation.finished));
  // The bridge cancels the animations it tracks; enter animations started here end in the natural state too.
  if (kind === 'enter') own.forEach((animation) => animation.cancel());
}

// Guarded so a re-evaluated module (dev HMR) never installs a second bridge.
export const bridge: TransitionBridge = (window.__kxrumiiTransitionBridge ??= installTransitionBridge({
  pageId: PAGE_ID,
  pageCanvasColor: LANDING_CANVAS,
  exit: (ctx) => animateParticipants(ctx, 'exit'),
  enter: (ctx) => animateParticipants(ctx, 'enter'),
}));

/** Keeps the Portal's prediction for this page at the landing colour. */
function keepLandingPublished(): void {
  publishCanvasColor(PAGE_ID, LANDING_CANVAS);
}

const currentCanvas = () => (root.dataset.tone === 'light' ? LIGHT_CANVAS : LANDING_CANVAS);

// The stage scope ends together with the transition that set it.
document.addEventListener(transitionEvents.transition, (event) => {
  const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
  if (phase === 'enter-end' || phase === 'recovered') {
    delete root.dataset.routeScope;
    keepLandingPublished();
  }
});

let revealPromise: Promise<void> | null = null;

/**
 * Hands the canvas off from LANDING_CANVAS to LIGHT_CANVAS. Text tone flips
 * halfway, where both inks still contrast with the mid-grey canvas.
 * Idempotent: later calls return the same promise.
 */
export function revealCanvas(): Promise<void> {
  if (revealPromise) return revealPromise;
  const finish = () => {
    root.dataset.tone = 'light';
    bridge.setPageCanvasColor(LIGHT_CANVAS);
    keepLandingPublished();
  };
  if (prefersReducedMotion()) {
    finish();
    revealPromise = Promise.resolve();
    return revealPromise;
  }
  const animation = root.animate([{ backgroundColor: LANDING_CANVAS }, { backgroundColor: LIGHT_CANVAS }], {
    duration: REVEAL_MS,
    easing: 'cubic-bezier(.4, 0, .2, 1)',
    fill: 'forwards',
  });
  const flip = window.setTimeout(() => {
    root.dataset.tone = 'light';
  }, REVEAL_MS / 2);
  revealPromise = animation.finished
    .then(() => {
      finish();
      animation.cancel();
    })
    .catch(() => {
      window.clearTimeout(flip);
      finish();
    });
  return revealPromise;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Gate -> stage hand-off: gate content exits, the canvas reveals, then shell
 * and stage enter (the canvas leads so the ink never fights the background).
 * `onRevealed` runs once the hidden content may become interactive.
 */
export async function playGateHandOff(onRevealed: () => void): Promise<void> {
  const reduce = prefersReducedMotion();
  const gateParts = Array.from(root.querySelectorAll<HTMLElement>('[data-gate-part][data-transition-exit]'));
  if (!reduce) await Promise.allSettled(animateElements(gateParts, 'exit').map((a) => a.finished));
  const reveal = revealCanvas();
  if (!reduce) await wait(180);
  const content = Array.from(root.querySelectorAll<HTMLElement>('[data-transition-enter]:not([data-gate-part])'));
  // Start from the pre-state (fill: both) before the gate attribute stops hiding the content.
  const entering = reduce ? [] : animatePageElements(content, 'enter').all;
  delete root.dataset.gate;
  onRevealed();
  await Promise.allSettled([reveal, ...entering.map((a) => a.finished)]);
  entering.forEach((a) => a.cancel());
}

/**
 * Marks page-ready after the shell has committed to the DOM. Effects run after
 * commit; markPageReady() is idempotent, so StrictMode's double invocation is safe.
 * Pass the route key so every route commit signals readiness again.
 */
export function usePageReady(routeKey?: string): void {
  useEffect(() => {
    bridge.markPageReady();
  }, [routeKey]);
}

/** Stagger index for an element taking part in the route transition. */
export function transitionIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/*
 * Same-document route transitions.
 *
 * BrowserRouter wraps every state update in React.startTransition, so
 * flushSync(() => navigate(to)) returns BEFORE the new route is committed.
 * The bridge's transitionTo() expects update() to resolve once the destination
 * DOM exists, so we wait for a real commit signal from the layout instead.
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

/** Called by the layout from a layout effect, right after a route has committed. */
export function notifyRouteCommit(): void {
  resolveRouteCommit?.();
}

/**
 * Navigate with the stage-scoped exit -> swap -> enter transition. Resolves to
 * false when a transition is already running.
 */
export function useTransitionNavigate(): (to: To) => Promise<boolean> {
  const navigate = useNavigate();
  return useCallback(
    async (to: To) => {
      if (root.dataset.transitionState) return false;
      root.dataset.routeScope = 'stage';
      const started = await bridge.transitionTo(
        async () => {
          const committed = nextRouteCommit(1500);
          navigate(to);
          await committed;
        },
        { canvasColor: currentCanvas() },
      );
      if (!started) delete root.dataset.routeScope;
      keepLandingPublished();
      return started;
    },
    [navigate],
  );
}
