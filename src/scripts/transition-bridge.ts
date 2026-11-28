/**
 * Adapter Shared Transition Bridge buat dokumen Astro (Home dan Portal).
 *
 * - Home ↔ Portal tetap lewat ClientRouter Astro dan page-transitions.ts; link-nya
 *   nggak punya `data-transition-link`, jadi bridge nggak pernah mencegatnya.
 * - Link Portal → app Vite (`data-transition-link="document"` + `data-astro-reload`)
 *   keluar lewat bridge, pakai ulang koreografi leaving Portal yang disetujui. Panjang
 *   hasil ukurnya dipakai buat menjadwalkan hand-off canvas.
 * - Kedatangan dari app Vite pakai ulang state entering Home/Portal yang disetujui.
 * - Swap ClientRouter mengganti semua atribut <html>, jadi bridge di-destroy sebelum
 *   tiap swap dan dipasang lagi buat halaman baru.
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
// Cuma batas pengaman (sama dengan fallback Home ↔ Portal). Jadwal canvas diambil
// dari koreografi hasil ukur di bawah, bukan dari nilai ini.
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
 * Exit Portal: mulai koreografi leaving yang disetujui, ukur transisi CSS yang benar-benar
 * jalan (delay dan stagger ikut), lalu publikasikan panjangnya sebelum return supaya
 * bridge menjadwalkan canvas dari situ (mulai di 55 %, selesai bareng konten).
 */
function portalDocumentExit(context: ExitEnterContext): Promise<unknown> {
  const transitions = beginPortalDocumentExit();

  // Nggak ada yang bisa diukur: pakai timing fallback bridge yang disetujui.
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
    // ClientRouter sudah prefetch link yang di-hover/fokus di halaman ini; <link rel="prefetch">
    // kedua dari bridge cuma duplikat.
    prefetch: false,
    exit: kind === 'portal' ? portalDocumentExit : undefined,
    enter: documentEnter,
  });

  if (bridge.incoming && !prefersReducedMotion()) armBridgeEnter(kind);
  // Shell hasil server-render sudah lengkap saat modul ini jalan.
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

  // Selama bridge keluar, navigasi lain nggak boleh mulai. Selama Astro keluar, cuma link
  // bridge yang ditahan; perilaku Astro ↔ Astro nggak berubah.
  if (bridgeLeaving || (astroLeaving && link.matches('a[data-transition-link]'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

const adapterWindow = window as Window & { __kxrumiiBridgeAdapterInstalled?: boolean };
if (!adapterWindow.__kxrumiiBridgeAdapterInstalled) {
  adapterWindow.__kxrumiiBridgeAdapterInstalled = true;

  // Didaftarkan sebelum capture listener milik bridge supaya jalan duluan.
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
