/**
 * Shared Transition Bridge adapter for the Astro documents (Home and Portal).
 *
 * - Home ↔ Portal stays on Astro's ClientRouter and page-transitions.ts; those
 *   links carry no `data-transition-link`, so the bridge never intercepts them.
 * - Portal → Vite app links (`data-transition-link="document"` +
 *   `data-astro-reload`) leave through the bridge, reusing the approved Portal
 *   leaving choreography. Its measured length schedules the canvas hand-off.
 * - Arrivals from a Vite app reuse the approved Home/Portal entering state.
 * - ClientRouter swaps replace every <html> attribute, so the bridge is
 *   destroyed before each swap and installed again for the new page.
 */
import {
  installTransitionBridge,
  transitionEvents,
  type ExitEnterContext,
  type TransitionBridge,
} from '@kxrumii/transition-bridge';
import {
  PORTAL_DOCUMENT_EXIT_CLASS,
  armBridgeEnter,
  beginPortalDocumentExit,
  clearBridgeEnter,
  currentMoodColor,
  recoverBridgeDocumentState,
  releaseBridgeEnter,
  remainingMs,
  type BridgeDocumentKind,
} from './page-transitions';

const HOME_CANVAS = '#0b0b0b';
// Safety ceiling only (same bound as the Home ↔ Portal fallback). The canvas
// schedule comes from the measured choreography below, not from this value.
const EXIT_MAX_MS = 1500;
const EXIT_FALLBACK_PROPERTY = '--transition-exit-fallback-ms';
const DEBUG_STORAGE_KEY = 'kxrumii:transition-debug';

let bridge: TransitionBridge | null = null;
let kind: BridgeDocumentKind = 'home';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function documentKind(): BridgeDocumentKind {
  return document.body?.dataset.page === 'portal' ? 'portal' : 'home';
}

function debugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Portal exit: start the approved leaving choreography, measure the CSS
 * transitions it actually started (delays and stagger included), and publish
 * that length before returning so the bridge schedules the canvas from it
 * (start at 55 %, finish together with the content).
 */
function portalDocumentExit(context: ExitEnterContext): Promise<unknown> {
  const transitions = beginPortalDocumentExit();

  // Nothing measurable: keep the bridge's approved fallback timing.
  if (!transitions.length) return Promise.resolve();

  const measured = remainingMs(transitions);
  const scheduled = Math.min(measured, EXIT_MAX_MS);
  if (measured > EXIT_MAX_MS) {
    console.warn(`[transition-bridge] Portal exit measured ${measured} ms, clamped to ${EXIT_MAX_MS} ms.`);
  }
  context.root.style.setProperty(EXIT_FALLBACK_PROPERTY, String(scheduled));

  if (debugEnabled()) {
    console.info(`[transition-bridge] Portal exit: ${transitions.length} transitions, ${measured} ms.`);
    console.table(
      transitions.map((transition) => {
        const timing = transition.effect?.getComputedTiming();
        const target = (transition.effect as KeyframeEffect | null)?.target;
        return {
          target: target instanceof Element ? `${target.tagName.toLowerCase()}.${target.className}` : '?',
          property: transition.transitionProperty,
          delay: timing?.delay,
          duration: timing?.duration,
          endTime: timing?.endTime,
        };
      }),
    );
  }

  return Promise.allSettled(transitions.map((transition) => transition.finished));
}

function documentEnter(): Promise<unknown> {
  const transitions = releaseBridgeEnter(kind);
  return Promise.allSettled(transitions.map((transition) => transition.finished));
}

function install(): void {
  kind = documentKind();
  bridge = installTransitionBridge({
    pageId: kind,
    pageCanvasColor: HOME_CANVAS,
    getCanvasColor: kind === 'portal' ? currentMoodColor : () => HOME_CANVAS,
    exitMaxMs: EXIT_MAX_MS,
    // ClientRouter already prefetches hovered/focused links on these pages;
    // a second <link rel="prefetch"> from the bridge would duplicate it.
    prefetch: false,
    exit: kind === 'portal' ? portalDocumentExit : undefined,
    enter: documentEnter,
  });

  if (bridge.incoming && !prefersReducedMotion()) armBridgeEnter(kind);
  // The server-rendered shell is complete when this module runs.
  bridge.markPageReady();
}

function uninstall(): void {
  bridge?.destroy();
  bridge = null;
}

function guardNavigationDuringExit(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement;
  const link = target?.closest('a[href]');
  if (!link) return;

  const root = document.documentElement;
  const bridgeLeaving = root.dataset.transitionState === 'leaving';
  const astroLeaving =
    root.classList.contains('home-transition-leaving') ||
    (root.classList.contains('portal-transition-leaving') && !root.classList.contains(PORTAL_DOCUMENT_EXIT_CLASS));

  // While the bridge leaves, no other navigation may start. While Astro leaves,
  // only bridge links are held back; Astro ↔ Astro behaviour is unchanged.
  if (bridgeLeaving || (astroLeaving && link.matches('a[data-transition-link]'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

const adapterWindow = window as Window & { __kxrumiiBridgeAdapterInstalled?: boolean };
if (!adapterWindow.__kxrumiiBridgeAdapterInstalled) {
  adapterWindow.__kxrumiiBridgeAdapterInstalled = true;

  // Registered before the bridge's own capture listener so it runs first.
  document.addEventListener('click', guardNavigationDuringExit, true);

  document.addEventListener(transitionEvents.transition, (event) => {
    const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
    if (phase === 'enter-end') clearBridgeEnter();
    else if (phase === 'recovered') recoverBridgeDocumentState();
  });

  new MutationObserver(() => {
    if (bridge && kind === 'portal') bridge.setPageCanvasColor(currentMoodColor());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mood'] });

  document.addEventListener('astro:before-swap', uninstall);
  document.addEventListener('astro:after-swap', install);

  install();
}
