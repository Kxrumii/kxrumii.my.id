/**
 * Hand-off teks yang nyambung antara homepage dan arsip PAW.
 * Elemen root HTML jadi canvas bersama; body dan isi halaman dibiarkan transparan.
 */

type PageIntent = 'to-portal' | 'to-home';
type Language = 'id' | 'en';

const HOME_PATH = '/';
const PORTAL_PATH = '/tugas/';
const MOOD_STORAGE_KEY = 'kxrumii-portal-mood-v2';
const LANGUAGE_STORAGE_KEY = 'kxrumii-portal-language';
const moodColors: Record<string, string> = {
  light: '#ffffff',
  dark: '#0b0b0b',
  red: '#ad1519',
  yellow: '#fabd00',
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let pendingIntent: PageIntent | null = null;
let lastKnownPath = window.location.pathname;
let transitionInProgress = false;
let enterReleaseScheduled = false;

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function resolveIntent(fromPath: string, toPath: string): PageIntent | null {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);
  if (from === HOME_PATH && to === PORTAL_PATH) return 'to-portal';
  if (from === PORTAL_PATH && to === HOME_PATH) return 'to-home';
  return null;
}

function elementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function getSavedMood(): string {
  try {
    const saved = localStorage.getItem(MOOD_STORAGE_KEY);
    return saved && Object.prototype.hasOwnProperty.call(moodColors, saved) ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

function getSavedLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

function getMoodColor(mood: string): string {
  return moodColors[mood] ?? moodColors.dark;
}

function appendCharacterLine(
  doc: Document,
  value: string,
  characterClass: string,
  wordClass?: string,
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  let characterIndex = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(doc.createTextNode(part));
      continue;
    }

    const word = wordClass ? doc.createElement('span') : null;
    if (word) word.className = wordClass ?? '';

    for (const character of Array.from(part)) {
      const letter = doc.createElement('span');
      letter.className = characterClass;
      letter.style.setProperty('--k', String(characterIndex++));
      letter.textContent = character;
      (word ?? fragment).append(letter);
    }

    if (word) fragment.append(word);
  }

  return fragment;
}

function makeProjectLetters(doc: Document, value: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  let index = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(doc.createTextNode(part));
      continue;
    }

    const word = doc.createElement('span');
    word.className = 'word';
    for (const character of Array.from(part)) {
      const reveal = doc.createElement('span');
      reveal.className = 'reveal-letter';
      reveal.style.setProperty('--k', String(index++));
      const letter = doc.createElement('span');
      letter.className = 'letter';
      letter.textContent = character;
      reveal.append(letter);
      word.append(reveal);
    }
    fragment.append(word);
  }
  return fragment;
}

function makeRoleLetters(doc: Document, value: string): DocumentFragment {
  return appendCharacterLine(doc, value, 'role-letter');
}

function makeAboutTitleLetters(doc: Document, value: string): DocumentFragment {
  return appendCharacterLine(doc, value, 'about-title-letter', 'about-title-word');
}

function makeAboutWords(doc: Document, value: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  let wordIndex = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(doc.createTextNode(part));
      continue;
    }

    const wrapper = doc.createElement('span');
    wrapper.className = 'about-word-wrap';
    const word = doc.createElement('span');
    word.className = 'about-word';
    word.style.setProperty('--w', String(wordIndex++));
    word.textContent = part;
    wrapper.append(word);
    fragment.append(wrapper);
  }
  return fragment;
}

function localizedValue(element: HTMLElement, language: Language): string {
  if (element.classList.contains('row-title')) {
    return element.dataset[language === 'id' ? 'textId' : 'textEn'] ?? '';
  }
  return element.dataset[language] ?? element.textContent ?? '';
}

function prepareHomeText(doc: Document): void {
  doc.querySelectorAll<HTMLElement>('[data-transition-copy]').forEach((host) => {
    if (host.dataset.transitionReady === 'true') return;

    const originalText = host.textContent ?? '';
    if (!originalText.trim()) return;

    const visual = doc.createElement('span');
    visual.className = 'transition-copy-visual';
    visual.setAttribute('aria-hidden', 'true');

    const groupIndex = Number(host.dataset.transitionGroup ?? '0');
    let charIndex = 0;

    for (const part of originalText.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        visual.append(doc.createTextNode(part));
        continue;
      }

      const word = doc.createElement('span');
      word.className = 'transition-copy-word';
      for (const character of Array.from(part)) {
        const mask = doc.createElement('span');
        mask.className = 'transition-copy-mask';
        const letter = doc.createElement('span');
        letter.className = 'transition-copy-char';
        letter.style.setProperty('--char-index', String(charIndex++));
        letter.style.setProperty('--group-index', String(groupIndex));
        letter.textContent = character;
        mask.append(letter);
        word.append(mask);
      }
      visual.append(word);
    }

    const accessible = doc.createElement('span');
    accessible.className = 'transition-copy-sr-only';
    accessible.textContent = originalText;
    host.replaceChildren(visual, accessible);
    host.dataset.transitionReady = 'true';
  });
}

/**
 * Lokalisasi dulu dokumen tujuan yang belum dipasang sebelum Astro swap.
 * Biar nggak ada flash ID-dulu, dan init page-load nggak ngeganti elemen yang datang
 * waktu gerak masuknya sudah jalan.
 */
function preparePortalDocument(doc: Document): void {
  const language = getSavedLanguage();
  const root = doc.documentElement;
  root.lang = language;

  doc.querySelectorAll<HTMLElement>('.row-title').forEach((host) => {
    const value = localizedValue(host, language);
    host.replaceChildren(makeProjectLetters(doc, value));
    host.dataset.lettersReady = 'true';
  });

  doc.querySelectorAll<HTMLElement>('[data-id][data-en]').forEach((element) => {
    const value = localizedValue(element, language);
    if (element.classList.contains('role-line')) {
      element.replaceChildren(makeRoleLetters(doc, value));
    } else if (element.classList.contains('about-title')) {
      element.replaceChildren(makeAboutTitleLetters(doc, value));
    } else if (element.matches('.about-copy p, .about-secondary p')) {
      element.replaceChildren(makeAboutWords(doc, value));
    } else {
      element.replaceChildren(doc.createTextNode(value));
    }
  });

  doc.querySelectorAll<HTMLImageElement>('[data-alt-id][data-alt-en]').forEach((image) => {
    image.alt = language === 'id' ? image.dataset.altId ?? '' : image.dataset.altEn ?? '';
  });

  doc.querySelectorAll<HTMLElement>('.project-row').forEach((row) => {
    const number = row.querySelector('.row-number')?.textContent?.trim() ?? '';
    const title = row.querySelector<HTMLElement>('.row-title');
    const category = row.querySelector<HTMLElement>('.row-category [data-id][data-en]');
    const titleText = title ? localizedValue(title, language) : '';
    const categoryText = category ? localizedValue(category, language) : '';
    row.setAttribute(
      'aria-label',
      `${number}, ${titleText}, ${categoryText}. ${language === 'id' ? 'Buka proyek.' : 'Open project.'}`,
    );
  });

  doc.querySelector('.brand-name')?.setAttribute(
    'aria-label',
    language === 'id' ? 'KXRUMII — halaman utama' : 'KXRUMII — home page',
  );
  doc.querySelector('#about-trigger')?.setAttribute(
    'aria-label',
    language === 'id' ? 'Tentang arsip PAW' : 'About the PAW archive',
  );
  doc.querySelector('#language-toggle')?.setAttribute(
    'aria-label',
    language === 'id' ? 'Bahasa Indonesia aktif. Switch to English.' : 'English active. Switch to Indonesian.',
  );
  doc.querySelector('.archive-list')?.setAttribute(
    'aria-label',
    language === 'id' ? 'Daftar tugas PAW' : 'PAW project list',
  );

  doc.title = language === 'id' ? 'KXRUMII — Arsip PAW' : 'KXRUMII — PAW Archive';
  doc.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    language === 'id'
      ? 'Arsip tugas dan eksperimen mata kuliah Pengembangan Aplikasi Web.'
      : 'An archive of assignments and experiments from the Web Application Development course.',
  );
}

function collectAnimations(selectors: string): Animation[] {
  return Array.from(document.querySelectorAll(selectors)).flatMap((element) =>
    element.getAnimations().filter((animation) => animation.playState !== 'finished'),
  );
}

async function waitForAnimations(animations: Animation[], fallbackMs: number): Promise<void> {
  if (!animations.length) return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, fallbackMs);
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
}

async function animateOutgoing(intent: PageIntent): Promise<void> {
  if (reducedMotion() || transitionInProgress) return;
  transitionInProgress = true;

  const root = document.documentElement;
  root.classList.add(intent === 'to-portal' ? 'home-transition-leaving' : 'portal-transition-leaving');
  // Flush perubahan class supaya semua transisi CSS transform terdaftar.
  void root.offsetHeight;

  const selectors = intent === 'to-portal'
    ? '.transition-copy-char, .transition-copy-decoration'
    : '.route-reveal-line, .role-line--archive .role-letter, .role-button:hover .role-line--about .role-letter, .role-button:focus-visible .role-line--about .role-letter, .row-title .letter';

  // Stagger maksimum hasil hitungan + gerak .84s masih di bawah batas fallback ini.
  await waitForAnimations(collectAnimations(selectors), 1500);
}

function applyPortalMoodToDocument(doc: Document): void {
  const root = doc.documentElement;
  const mood = getSavedMood();
  root.dataset.mood = mood;
  root.style.setProperty('--route-canvas-color', getMoodColor(mood));
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', getMoodColor(mood));
}

function finishTransitionState(): void {
  const root = document.documentElement;
  root.classList.remove(
    'portal-transition-entering',
    'home-transition-entering',
    'home-transition-leaving',
    'portal-transition-leaving',
  );
  root.style.removeProperty('--route-canvas-color');
  lastKnownPath = window.location.pathname;
  pendingIntent = null;
  transitionInProgress = false;
  enterReleaseScheduled = false;
}

/*
 * Kunci interaksi transisi. Selama transisi rute, CSS yang pakai `data-transition-lock`
 * mencegah efek hover baru mulai (lihat page-transitions.css). Kunci mencakup gerak keluar,
 * swap dokumen, dan gerak masuk; dilepas saat transisi masuk selesai, saat gagal, saat
 * restore bfcache, atau lewat timeout pengaman, jadi nggak pernah nyangkut.
 */
const INTERACTION_LOCK_ATTRIBUTE = 'data-transition-lock';
const INTERACTION_LOCK_MAX_MS = 4000;
let interactionLockToken = 0;
let interactionLockTimer = 0;

function setInteractionLock(root: HTMLElement): number {
  root.setAttribute(INTERACTION_LOCK_ATTRIBUTE, '');
  window.clearTimeout(interactionLockTimer);
  const token = ++interactionLockToken;
  interactionLockTimer = window.setTimeout(() => releaseInteractionLock(token), INTERACTION_LOCK_MAX_MS);
  return token;
}

/** Lepas kunci; kalau ada token, cuma kalau belum diambil alih transisi yang lebih baru. */
export function releaseInteractionLock(token?: number): void {
  if (token !== undefined && token !== interactionLockToken) return;
  window.clearTimeout(interactionLockTimer);
  document.documentElement.removeAttribute(INTERACTION_LOCK_ATTRIBUTE);
}

function releaseInteractionLockAfterEnter(): void {
  const token = interactionLockToken;
  const targets = document.querySelectorAll(`${BRIDGE_MOTION_TARGETS.home}, ${BRIDGE_MOTION_TARGETS.portal}`);
  void document.documentElement.offsetHeight;
  const running = Array.from(targets)
    .flatMap((element) => element.getAnimations())
    .filter((animation) => animation instanceof CSSTransition
      && MOTION_PROPERTIES.has(animation.transitionProperty)
      && animation.playState !== 'idle'
      && animation.playState !== 'finished');
  if (!running.length) {
    releaseInteractionLock(token);
    return;
  }
  void Promise.race([
    Promise.allSettled(running.map((animation) => animation.finished)),
    new Promise((resolve) => window.setTimeout(resolve, 1600)),
  ]).then(() => releaseInteractionLock(token));
}

function releaseIncomingText(): void {
  if (enterReleaseScheduled) return;
  enterReleaseScheduled = true;

  const root = document.documentElement;
  // State masuk dipertahankan satu paint, baru mask dilepas. Gerak masuk jadi mulai di
  // astro:after-swap, nggak nunggu page-load.
  requestAnimationFrame(() => {
    void root.offsetHeight;
    requestAnimationFrame(() => {
      finishTransitionState();
      releaseInteractionLockAfterEnter();
    });
  });
}

function installTransitionListeners(): void {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = elementFromEventTarget(event.target);
    const link = target?.closest<HTMLAnchorElement>('a[data-page-transition]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    if (link.dataset.pageTransition === 'portal' && normalizePath(window.location.pathname) === HOME_PATH) {
      pendingIntent = 'to-portal';
      document.documentElement.style.setProperty('--route-canvas-color', getMoodColor(getSavedMood()));
    } else if (link.dataset.pageTransition === 'home' && normalizePath(window.location.pathname) === PORTAL_PATH) {
      pendingIntent = 'to-home';
    }
  }, true);

  window.addEventListener('popstate', () => {
    pendingIntent = resolveIntent(lastKnownPath, window.location.pathname);
    if (pendingIntent === 'to-portal') {
      document.documentElement.style.setProperty('--route-canvas-color', getMoodColor(getSavedMood()));
    }
  });

  document.addEventListener('astro:before-preparation', (rawEvent) => {
    if (!pendingIntent) return;
    const event = rawEvent as Event & { loader: () => Promise<unknown> };
    const originalLoader = event.loader;
    const intent = pendingIntent;

    event.loader = async () => {
      setInteractionLock(document.documentElement);
      try {
        const animationPromise = animateOutgoing(intent);
        const loadedDocument = await originalLoader();
        await animationPromise;
        return loadedDocument;
      } catch (error) {
        document.documentElement.classList.remove('home-transition-leaving', 'portal-transition-leaving');
        document.documentElement.style.removeProperty('--route-canvas-color');
        pendingIntent = null;
        transitionInProgress = false;
        releaseInteractionLock();
        throw error;
      }
    };
  });

  document.addEventListener('astro:before-swap', (rawEvent) => {
    if (!pendingIntent) return;
    const event = rawEvent as Event & { newDocument: Document };
    const destination = event.newDocument;
    // Atribut root diganti oleh swap, jadi kunci ikut pindah ke dokumen baru.
    setInteractionLock(destination.documentElement);

    if (pendingIntent === 'to-portal') {
      applyPortalMoodToDocument(destination);
      preparePortalDocument(destination);
      if (!reducedMotion()) destination.documentElement.classList.add('portal-transition-entering');
    } else {
      const currentMood = document.documentElement.dataset.mood ?? 'dark';
      destination.documentElement.style.setProperty('--route-canvas-color', getMoodColor(currentMood));
      prepareHomeText(destination);
      if (!reducedMotion()) destination.documentElement.classList.add('home-transition-entering');
    }
  });

  document.addEventListener('astro:after-swap', () => {
    if (pendingIntent) releaseIncomingText();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) releaseInteractionLock();
  });

  document.addEventListener('astro:page-load', () => {
    prepareHomeText(document);
    if (pendingIntent && !enterReleaseScheduled) releaseIncomingText();
    if (!pendingIntent) {
      lastKnownPath = window.location.pathname;
      transitionInProgress = false;
    }
  });
}

prepareHomeText(document);

const transitionWindow = window as Window & { __kxrumiiPageTransitionsInstalled?: boolean };
if (!transitionWindow.__kxrumiiPageTransitionsInstalled) {
  transitionWindow.__kxrumiiPageTransitionsInstalled = true;
  installTransitionListeners();
}

/* -------------------------------------------------------------------------
 * Dukungan Shared Transition Bridge (navigasi dokumen dari/ke app Vite).
 * Helper ini pakai ulang class koreografi di atas; alur Home ↔ Portal nggak
 * berubah karena nggak pernah set class di bawah.
 * ---------------------------------------------------------------------- */

export type BridgeDocumentKind = 'home' | 'portal';

/** Modifier root yang cuma ada saat Portal keluar menuju dokumen Vite. */
export const PORTAL_DOCUMENT_EXIT_CLASS = 'portal-document-exit';

const BRIDGE_ARMED_CLASSES: Record<BridgeDocumentKind, string> = {
  home: 'home-bridge-armed',
  portal: 'portal-bridge-armed',
};

const BRIDGE_ENTERING_CLASSES: Record<BridgeDocumentKind, string> = {
  home: 'home-transition-entering',
  portal: 'portal-transition-entering',
};

// Elemen yang transform-nya membawa koreografi yang disetujui.
const BRIDGE_MOTION_TARGETS: Record<BridgeDocumentKind, string> = {
  home: '.transition-copy-char, .transition-copy-decoration',
  portal: '.route-reveal-line, .role-letter, .row-title .letter',
};

const PORTAL_DOCUMENT_EXIT_TARGETS = `${BRIDGE_MOTION_TARGETS.portal}, .project-row .preview-veil, .project-row .preview-veil img`;

const MOTION_PROPERTIES = new Set(['transform', 'translate']);

/**
 * Jalankan `mutate`, lalu kembalikan cuma transisi CSS yang dimulainya pada target `selector`.
 * Dikecualikan: transisi yang sudah ada sebelumnya, properti/elemen lain, dan transisi idle/selesai (cancelled).
 */
export function collectNewTransitions(selector: string, mutate: () => void): CSSTransition[] {
  const targets = Array.from(document.querySelectorAll(selector));
  const targetSet = new Set<Element>(targets);
  const before = new Set<Animation>(targets.flatMap((element) => element.getAnimations()));

  mutate();
  void document.documentElement.offsetHeight;

  const started: CSSTransition[] = [];
  for (const element of targets) {
    for (const animation of element.getAnimations()) {
      if (!(animation instanceof CSSTransition) || before.has(animation)) continue;
      if (!MOTION_PROPERTIES.has(animation.transitionProperty)) continue;
      if (animation.playState === 'idle' || animation.playState === 'finished') continue;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!target || !targetSet.has(target)) continue;
      started.push(animation);
    }
  }
  return started;
}

/** Sisa waktu terpanjang (ms) dari animasi yang diberikan (delay + duration − elapsed). */
export function remainingMs(animations: readonly Animation[]): number {
  let longest = 0;
  for (const animation of animations) {
    const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
    const elapsed = Number(animation.currentTime ?? 0);
    longest = Math.max(longest, end - elapsed);
  }
  return Math.max(0, Math.ceil(longest));
}

function cancelAnimations(animations: readonly Animation[]): void {
  for (const animation of animations) {
    try {
      animation.cancel();
    } catch {
      // Sudah selesai atau sudah dihapus.
    }
  }
}

/** Warna canvas Portal yang sebenarnya untuk mood saat ini. */
export function currentMoodColor(): string {
  return getMoodColor(document.documentElement.dataset.mood ?? 'dark');
}

/** Mulai koreografi leaving Portal yang disetujui buat navigasi ke dokumen Vite. */
export function beginPortalDocumentExit(): CSSTransition[] {
  const root = document.documentElement;
  return collectNewTransitions(PORTAL_DOCUMENT_EXIT_TARGETS, () => {
    root.classList.add('portal-transition-leaving', PORTAL_DOCUMENT_EXIT_CLASS);
  });
}

/**
 * Pasang dokumen yang datang ke pre-state entering yang disetujui tanpa gerak kelihatan
 * (transisi yang dibuat saat arming langsung di-cancel).
 */
export function armBridgeEnter(kind: BridgeDocumentKind): void {
  const root = document.documentElement;
  if (kind === 'home') prepareHomeText(document);
  const created = collectNewTransitions(BRIDGE_MOTION_TARGETS[kind], () => {
    root.classList.add(BRIDGE_ENTERING_CLASSES[kind], BRIDGE_ARMED_CLASSES[kind]);
  });
  cancelAnimations(created);
}

/** Lepas pre-state entering; kembalikan transisi enter yang disetujui. */
export function releaseBridgeEnter(kind: BridgeDocumentKind): CSSTransition[] {
  const root = document.documentElement;
  if (!root.classList.contains(BRIDGE_ARMED_CLASSES[kind])) return [];
  return collectNewTransitions(BRIDGE_MOTION_TARGETS[kind], () => {
    root.classList.remove(BRIDGE_ENTERING_CLASSES[kind]);
  });
}

/** Hapus penanda arming bridge setelah enter selesai. */
export function clearBridgeEnter(): void {
  document.documentElement.classList.remove(BRIDGE_ARMED_CLASSES.home, BRIDGE_ARMED_CLASSES.portal);
}

/**
 * Balikin state diam secara instan setelah restore bfcache atau navigasi macet:
 * state khusus bridge dihapus, state rute bersama direset, dan transisi yang dimulai
 * reset di-cancel (nggak ada gerak kelihatan).
 */
export function recoverBridgeDocumentState(): void {
  const root = document.documentElement;
  const created = collectNewTransitions(
    `${PORTAL_DOCUMENT_EXIT_TARGETS}, ${BRIDGE_MOTION_TARGETS.home}`,
    () => {
      root.classList.remove(
        PORTAL_DOCUMENT_EXIT_CLASS,
        BRIDGE_ARMED_CLASSES.home,
        BRIDGE_ARMED_CLASSES.portal,
        BRIDGE_ENTERING_CLASSES.home,
        BRIDGE_ENTERING_CLASSES.portal,
      );
      root.style.removeProperty('--transition-exit-fallback-ms');
      finishTransitionState();
      releaseInteractionLock();
    },
  );
  cancelAnimations(created);
}
