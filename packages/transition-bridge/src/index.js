/**
 * @kxrumii/transition-bridge — v0.4 (tanpa overlay)
 *
 * Kontrak:
 *  - Halaman ASAL punya exit-nya sendiri (elemen `[data-transition-exit]`) dan
 *    memulai perpindahan warna latar (canvas) ke warna TUJUAN.
 *  - Halaman TUJUAN ngecat warna canvas itu dari first paint (bootstrap inline),
 *    lalu jalanin enter-nya (`[data-transition-enter]`) setelah `page-ready`.
 *  - Nggak ada layer penutup, nggak ada opacity. Kesinambungan datang dari warna
 *    latar yang sudah sama + gerak yang nyambung.
 *  - Gerak elemen dibaca dari CSS custom property tiap halaman (jarak, clip, durasi,
 *    easing, stagger) dan dijalankan lewat WAAPI dengan keyframe eksplisit, jadi
 *    nggak tergantung urutan style/paint.
 */

const HANDSHAKE_KEY = 'kxrumii:transition:v4';
const CANVAS_KEY = 'kxrumii:canvas:v1';
const PAGE_READY_EVENT = 'kxrumii:page-ready';
const SCENE_READY_EVENT = 'kxrumii:scene-ready';
const TRANSITION_EVENT = 'kxrumii:transition';

const DEFAULTS = {
  pageId: 'page',
  pageCanvasColor: '#0b0b0b',
  getCanvasColor: null,
  fallbackCanvasColor: '#0b0b0b',
  linkSelector: 'a[data-transition-link="document"]',
  exitMaxMs: 1400,
  enterMaxMs: 1800,
  pageReadyTimeoutMs: 1600,
  stallRecoveryMs: 3500,
  prefetch: true,
  exit: null,
  enter: null,
};

const normalizePath = (p) => (!p || p === '/' ? '/' : `${p.replace(/\/+$/, '')}/`);
const dispatch = (name, detail = {}) => document.dispatchEvent(new CustomEvent(name, { detail }));
const isModifiedClick = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));

function cssNumber(el, prop, fallback) {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(prop));
  return Number.isFinite(v) ? v : fallback;
}
function cssString(el, prop, fallback) {
  const v = getComputedStyle(el).getPropertyValue(prop).trim();
  return v || fallback;
}

/* ---- Warna canvas halaman: dipublikasikan biar halaman lain tahu warna aktualnya (tema/mood) ---- */
function readCanvasMap() {
  try {
    return JSON.parse(localStorage.getItem(CANVAS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
export function publishCanvasColor(pageId, color) {
  try {
    const map = readCanvasMap();
    map[pageId] = color;
    localStorage.setItem(CANVAS_KEY, JSON.stringify(map));
  } catch {
    /* storage mati: tujuan pakai warna fallback dari atribut link */
  }
}
export function readPublishedCanvasColor(pageId) {
  return pageId ? (readCanvasMap()[pageId] ?? null) : null;
}

/**
 * Jalankan exit/enter bawaan buat sekumpulan elemen. Mengembalikan daftar Animation.
 * Semua parameter dibaca dari CSS custom property elemen (lihat README).
 */
export function animateElements(elements, kind) {
  const out = [];
  for (const el of elements) {
    const isExit = kind === 'exit';
    const duration = cssNumber(el, `--transition-${kind}-duration`, isExit ? 380 : 620);
    const delay =
      cssNumber(el, `--transition-${kind}-delay`, 0) +
      cssNumber(el, '--i', 0) * cssNumber(el, '--transition-stagger', 0);
    const easing = cssString(el, `--transition-${kind}-ease`, isExit ? 'cubic-bezier(.45,0,.2,1)' : 'cubic-bezier(.16,1,.3,1)');

    const transform = isExit
      ? cssString(el, '--transition-exit-transform', 'translate3d(0,-12vh,0)')
      : cssString(el, '--transition-enter-from-transform', 'translate3d(0,8vh,0)');
    const clipFrom = isExit
      ? cssString(el, '--transition-exit-clip-from', 'inset(0 0 0 0)')
      : cssString(el, '--transition-enter-from-clip', 'inset(100% 0 0 0)');
    const clipTo = isExit
      ? cssString(el, '--transition-exit-clip', 'inset(0 0 100% 0)')
      : cssString(el, '--transition-enter-clip', 'inset(0 0 0 0)');

    const from = isExit ? { transform: 'none' } : { transform };
    const to = isExit ? { transform } : { transform: 'none' };
    if (clipFrom !== 'none' && clipTo !== 'none') {
      from.clipPath = clipFrom;
      to.clipPath = clipTo;
    }
    out.push(el.animate([from, to], { duration, delay, easing, fill: isExit ? 'forwards' : 'both' }));
  }
  return out;
}

export function installTransitionBridge(userOptions = {}) {
  const o = { ...DEFAULTS, ...userOptions };
  const root = document.documentElement;
  const pageId = o.pageId;
  const incoming = root.dataset.transitionState === 'entering';

  let disposed = false;
  let busy = incoming; // klik navigasi ditahan selama hand-off
  let pageReady = false;
  let sceneReady = false;
  let releasing = false;
  let readinessTimer = null;
  let stallTimer = null;
  let active = []; // Animation milik bridge, supaya bisa dibersihkan
  const prefetched = new Set();

  const currentColor = () => (typeof o.getCanvasColor === 'function' ? o.getCanvasColor() : null) || o.pageCanvasColor;
  let canvasColor = currentColor();

  function setPageCanvasColor(color) {
    if (typeof color !== 'string' || !color.trim()) return;
    canvasColor = color;
    root.style.setProperty('--page-canvas', color);
    publishCanvasColor(pageId, color);
  }

  root.dataset.transitionPage = pageId;
  setPageCanvasColor(canvasColor);

  function cancelActive() {
    for (const a of active) {
      try {
        a.cancel();
      } catch {
        /* sudah selesai */
      }
    }
    active = [];
  }

  async function settle(animations, extra, maxMs) {
    const jobs = animations.map((a) => a.finished.catch(() => {}));
    if (extra) jobs.push(Promise.resolve(extra).catch(() => {}));
    await Promise.race([Promise.allSettled(jobs), wait(maxMs)]);
  }

  function ctxFor(elements, extra = {}) {
    // Animasi dari hook kustom tetap dilacak, supaya bisa dibatalkan saat recover/finish.
    const tracked = (els, kind) => {
      const made = animateElements(els, kind);
      active.push(...made);
      return made;
    };
    return { root, elements, reducedMotion: false, animateElements: tracked, ...extra };
  }

  /* ---------------- EXIT (halaman asal) ---------------- */
  async function runExit(toColor) {
    root.dataset.transitionState = 'leaving';
    document.body?.setAttribute('aria-busy', 'true');
    dispatch(TRANSITION_EVENT, { phase: 'exit-start', fromPage: pageId, toColor });

    if (reducedMotion()) {
      root.style.setProperty('--page-canvas', toColor);
      return;
    }

    const elements = Array.from(root.querySelectorAll('[data-transition-exit]'));

    // 1) Gerak konten jalan dulu; butuh waktu selesainya buat menjadwalkan canvas.
    const startIdx = active.length;
    let custom = null;
    let anims = [];
    if (typeof o.exit === 'function') {
      custom = o.exit(ctxFor(elements, { toColor })); // animasi dari hook dilacak lewat ctx.animateElements
      anims = active.slice(startIdx);
    } else {
      anims = animateElements(elements, 'exit');
      active.push(...anims);
    }

    // 2) Canvas pindah warna MENGIKUTI exit konten: mulai sekitar 55% dan selesai pas exit selesai.
    //    Kalau canvas berubah duluan, teks halaman asal kehilangan kontras (mis. teks terang di atas
    //    latar yang sudah terang) dan transisi kelihatan "berhenti" padahal animasinya masih jalan.
    const endOf = (a) => {
      try {
        return a.effect.getComputedTiming().endTime;
      } catch {
        return 0;
      }
    };
    const contentEnd = anims.length ? Math.max(...anims.map(endOf)) : cssNumber(root, '--transition-exit-fallback-ms', 600);
    const explicitDelay = cssString(root, '--transition-canvas-delay', '');
    const explicitDuration = cssString(root, '--transition-canvas-duration', '');
    const canvasDelay = explicitDelay ? parseFloat(explicitDelay) : Math.round(contentEnd * cssNumber(root, '--transition-canvas-start', 0.55));
    const canvasDuration = explicitDuration ? parseFloat(explicitDuration) : Math.max(240, contentEnd - canvasDelay);
    const canvas = root.animate([{ backgroundColor: canvasColor }, { backgroundColor: toColor }], {
      duration: canvasDuration,
      delay: canvasDelay,
      easing: cssString(root, '--transition-canvas-ease', 'cubic-bezier(.4,0,.6,1)'),
      fill: 'forwards',
    });
    active.push(canvas);
    await settle([canvas, ...anims], custom, o.exitMaxMs);
  }

  /* ---------------- ENTER (halaman tujuan) ---------------- */
  function finishIncoming() {
    delete root.dataset.transitionState;
    root.removeAttribute('data-transition-from');
    root.style.removeProperty('--transition-origin-x');
    root.style.removeProperty('--transition-origin-y');
    cancelActive(); // kondisi akhir = kondisi natural, jadi nggak ada lompatan
    document.body?.removeAttribute('aria-busy');
    busy = false;
    releasing = false;
    dispatch(TRANSITION_EVENT, { phase: 'enter-end', pageId });
  }

  async function releaseIncoming() {
    if (releasing || root.dataset.transitionState !== 'entering') return;
    releasing = true;
    await nextFrame(); // keyframe awal == pre-state CSS dari bootstrap, jadi satu frame cukup buat flush style
    if (disposed) return;
    if (root.dataset.transitionState !== 'entering') {
      // State sudah dihapus pihak lain (fail-open bootstrap): lepas kunci supaya klik nggak tertelan.
      busy = false;
      releasing = false;
      document.body?.removeAttribute('aria-busy');
      return;
    }

    if (reducedMotion()) {
      finishIncoming();
      return;
    }
    dispatch(TRANSITION_EVENT, { phase: 'enter-start', pageId });
    const elements = Array.from(root.querySelectorAll('[data-transition-enter]'));
    let custom = null;
    let anims = [];
    if (typeof o.enter === 'function') {
      custom = o.enter(ctxFor(elements));
    } else {
      anims = animateElements(elements, 'enter');
    }
    active.push(...anims);
    await settle(anims, custom, o.enterMaxMs);
    if (disposed) return;
    finishIncoming();
  }

  function markPageReady(detail = {}) {
    if (disposed || pageReady) return;
    pageReady = true;
    window.clearTimeout(readinessTimer);
    window.clearTimeout(window.__kxrumiiTransitionBootstrapTimer);
    const isIncoming = root.dataset.transitionState === 'entering';
    if (!isIncoming) busy = false;
    root.dataset.transitionPageReady = 'true';
    dispatch(PAGE_READY_EVENT, { pageId, incoming: isIncoming, ...detail });
    dispatch(TRANSITION_EVENT, { phase: 'page-ready', pageId, ...detail });
    if (isIncoming) void releaseIncoming();
  }

  function markSceneReady(detail = {}) {
    if (disposed || sceneReady) return;
    sceneReady = true;
    root.dataset.sceneState = 'ready';
    dispatch(SCENE_READY_EVENT, { pageId, ...detail });
    dispatch(TRANSITION_EVENT, { phase: 'scene-ready', pageId, ...detail });
  }

  /* ---------------- Navigasi lintas-dokumen ---------------- */
  function warm(url) {
    if (!o.prefetch || prefetched.has(url.href) || url.origin !== location.origin) return;
    prefetched.add(url.href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url.href;
    document.head.append(link);
  }

  function recover(reason) {
    window.clearTimeout(stallTimer);
    cancelActive();
    delete root.dataset.transitionState;
    root.style.setProperty('--page-canvas', canvasColor);
    document.body?.removeAttribute('aria-busy');
    try {
      sessionStorage.removeItem(HANDSHAKE_KEY);
    } catch {
      /* abaikan */
    }
    busy = false;
    releasing = false;
    dispatch(TRANSITION_EVENT, { phase: 'recovered', pageId, reason });
  }

  async function navigateDocument(anchor, event) {
    if (busy) return;
    busy = true;
    const destination = new URL(anchor.href, location.href);
    const toPage = anchor.dataset.transitionPage || null;
    const toColor = readPublishedCanvasColor(toPage) || anchor.dataset.transitionCanvas || o.fallbackCanvasColor;

    try {
      sessionStorage.setItem(
        HANDSHAKE_KEY,
        JSON.stringify({
          version: 4,
          fromPage: pageId,
          toPage,
          toPath: normalizePath(destination.pathname),
          canvasColor: toColor,
          origin: event ? { x: event.clientX, y: event.clientY } : null,
          expiresAt: Date.now() + 10_000,
        }),
      );
    } catch {
      /* tanpa storage: tujuan dimuat biasa, exit tetap jalan */
    }

    warm(destination);
    await runExit(toColor);
    if (disposed) return;
    dispatch(TRANSITION_EVENT, { phase: 'navigate', fromPage: pageId });
    location.assign(destination.href);
    // Kalau dokumen ini masih hidup lama setelah navigasi mulai, layar nggak boleh kosong terus.
    stallTimer = window.setTimeout(() => recover('navigation-stalled'), o.stallRecoveryMs);
  }

  function linkFrom(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const a = target?.closest(o.linkSelector);
    return a instanceof HTMLAnchorElement ? a : null;
  }

  function onClick(event) {
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const anchor = linkFrom(event);
    if (!anchor) return;
    if (busy) {
      event.preventDefault();
      return;
    }
    if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    const dest = new URL(anchor.href, location.href);
    if (dest.origin !== location.origin) return;
    if (normalizePath(dest.pathname) === normalizePath(location.pathname) && dest.search === location.search) return;
    event.preventDefault();
    void navigateDocument(anchor, event);
  }

  function onWarm(event) {
    const anchor = linkFrom(event);
    if (anchor) warm(new URL(anchor.href, location.href));
  }

  function onPageShow(event) {
    if (event.persisted) recover('bfcache-restore');
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('pointerover', onWarm, { passive: true });
  document.addEventListener('focusin', onWarm);
  window.addEventListener('pageshow', onPageShow);

  if (incoming) {
    readinessTimer = window.setTimeout(() => {
      if (!pageReady) markPageReady({ fallback: true, reason: 'page-ready-timeout' });
    }, o.pageReadyTimeoutMs);
  }

  /* ---------------- Navigasi same-document (SPA / React Router) ---------------- */
  async function transitionTo(update, opts = {}) {
    if (disposed || busy || typeof update !== 'function') return false;
    busy = true;
    pageReady = false;
    const toColor = opts.canvasColor || readPublishedCanvasColor(opts.toPage) || o.fallbackCanvasColor;
    await runExit(toColor);

    // Ganti isi halaman: warna tujuan sudah tampil, elemen baru mulai dari pre-state.
    root.dataset.transitionState = 'entering';
    root.style.setProperty('--page-canvas', toColor);
    canvasColor = toColor;
    publishCanvasColor(pageId, toColor);
    root.getAnimations().filter((a) => active.includes(a) && a.effect?.target === root).forEach((a) => a.cancel());

    const ready = new Promise((resolve) => {
      const t = window.setTimeout(() => resolve(false), opts.pageReadyTimeoutMs ?? o.pageReadyTimeoutMs);
      document.addEventListener(
        PAGE_READY_EVENT,
        () => {
          window.clearTimeout(t);
          resolve(true);
        },
        { once: true },
      );
    });
    try {
      await update();
    } catch (error) {
      recover('spa-update-failed');
      throw error;
    }
    cancelActive(); // elemen lama sudah nggak ada; pre-state CSS ambil alih di frame yang sama
    if (!(await ready) && !pageReady) markPageReady({ fallback: true, reason: 'spa-page-ready-timeout' });
    return true;
  }

  function destroy() {
    disposed = true;
    window.clearTimeout(readinessTimer);
    window.clearTimeout(stallTimer);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('pointerover', onWarm);
    document.removeEventListener('focusin', onWarm);
    window.removeEventListener('pageshow', onPageShow);
    cancelActive();
  }

  return { pageId, incoming, markPageReady, markSceneReady, transitionTo, setPageCanvasColor, destroy };
}

export const transitionEvents = Object.freeze({
  pageReady: PAGE_READY_EVENT,
  sceneReady: SCENE_READY_EVENT,
  transition: TRANSITION_EVENT,
});
export const transitionStorageKey = HANDSHAKE_KEY;
