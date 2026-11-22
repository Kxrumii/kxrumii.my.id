import { portalProjects } from '../data/portal-projects';

const moodOrder = ['light', 'dark', 'red', 'yellow'] as const;
type Mood = (typeof moodOrder)[number];
type Language = 'id' | 'en';

const moodNames: Record<Mood, string> = {
  light: 'Light',
  dark: 'Dark',
  red: 'Red',
  yellow: 'Yellow',
};

const themeColors: Record<Mood, string> = {
  light: '#ffffff',
  dark: '#0b0b0b',
  red: '#ad1519',
  yellow: '#fabd00',
};

const MOOD_STORAGE_KEY = 'kxrumii-portal-mood-v2';
const LANGUAGE_STORAGE_KEY = 'kxrumii-portal-language';
const LANGUAGE_DURATION = 850;
// A balanced ease keeps the hand-off visibly moving instead of almost jumping
// to its destination in the first 100 ms.
const LANGUAGE_EASING = 'cubic-bezier(.16, 1, .3, 1)';

let currentLanguage: Language = 'id';
let previousFocus: HTMLElement | null = null;
let languageTransitioning = false;

function getRoot(): HTMLElement {
  return document.documentElement;
}

function isMood(value: string | null): value is Mood {
  return value !== null && moodOrder.includes(value as Mood);
}

function textNode(value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(document.createTextNode(value));
  return fragment;
}

function makeRoleLetters(value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const character of Array.from(value)) {
    const letter = document.createElement('span');
    letter.className = 'role-letter';
    letter.style.setProperty('--k', String(index++));
    letter.textContent = character;
    fragment.append(letter);
  }
  return fragment;
}

function makeTitleLetters(value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      continue;
    }

    const word = document.createElement('span');
    word.className = 'about-title-word';
    for (const character of Array.from(part)) {
      const letter = document.createElement('span');
      letter.className = 'about-title-letter';
      letter.style.setProperty('--k', String(index++));
      letter.textContent = character;
      word.append(letter);
    }
    fragment.append(word);
  }
  return fragment;
}

function makeAboutWords(value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      continue;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'about-word-wrap';
    const word = document.createElement('span');
    word.className = 'about-word';
    word.style.setProperty('--w', String(index++));
    word.textContent = part;
    wrapper.append(word);
    fragment.append(wrapper);
  }
  return fragment;
}

function makeProjectLetters(value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      continue;
    }

    const word = document.createElement('span');
    word.className = 'word';
    for (const character of Array.from(part)) {
      const reveal = document.createElement('span');
      reveal.className = 'reveal-letter';
      reveal.style.setProperty('--k', String(index++));
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = character;
      reveal.append(letter);
      word.append(reveal);
    }
    fragment.append(word);
  }
  return fragment;
}

function localizedText(element: HTMLElement, language: Language): string {
  if (element.classList.contains('row-title')) {
    return element.dataset[language === 'id' ? 'textId' : 'textEn'] ?? '';
  }
  return element.dataset[language] ?? element.textContent ?? '';
}

function languageContent(element: HTMLElement, value: string): DocumentFragment {
  if (element.classList.contains('row-title')) return makeProjectLetters(value);
  if (element.classList.contains('role-line')) return makeRoleLetters(value);
  if (element.classList.contains('about-title')) return makeTitleLetters(value);
  if (element.matches('.about-copy p, .about-secondary p')) return makeAboutWords(value);
  return textNode(value);
}

function allLanguageTargets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-id][data-en], .row-title'));
}

function languageTargets(): HTMLElement[] {
  // Only animate content the user can currently see. Closed About copy and the
  // off-screen skip link are localized immediately after the visible hand-off,
  // so they do not create a long artificial stagger on the project list.
  return allLanguageTargets().filter((element) => {
    if (element.closest('#about-panel') && !getRoot().classList.contains('about-open')) return false;
    if (element.matches('.skip-link') && document.activeElement !== element) return false;
    if (element.matches('.role-line--about')) {
      const roleButton = element.closest('.role-button');
      return Boolean(roleButton?.matches(':hover, :focus-visible'));
    }
    return true;
  });
}

function applyUntargetedLanguage(value: Language, animatedTargets: HTMLElement[]): void {
  const animated = new Set(animatedTargets);
  allLanguageTargets().forEach((element) => {
    if (animated.has(element)) return;
    const text = localizedText(element, value);
    element.replaceChildren(languageContent(element, text));
    if (element.classList.contains('row-title')) element.dataset.lettersReady = 'true';
  });
}

function updateHiddenRoleLabel(language: Language): void {
  const element = document.querySelector<HTMLElement>('.role-line--about');
  if (!element) return;
  const value = element.dataset[language] ?? element.textContent ?? '';
  if (element.textContent?.trim() === value.trim() && element.querySelector('.role-letter')) return;
  element.replaceChildren(makeRoleLetters(value));
}

function setMood(value: Mood, persist = false): void {
  const root = getRoot();
  root.dataset.mood = value;

  const label = document.getElementById('mood-name');
  const button = document.getElementById('mood-toggle');
  if (label) label.textContent = moodNames[value];
  button?.setAttribute(
    'aria-label',
    currentLanguage === 'id'
      ? `${moodNames[value]}. Ganti warna website.`
      : `${moodNames[value]} mood. Change website colors.`,
  );

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[value]);
  if (persist) {
    try {
      localStorage.setItem(MOOD_STORAGE_KEY, value);
    } catch {
      // The current page theme still works when storage is unavailable.
    }
  }
}

function updateLanguageSemantics(value: Language, persist: boolean): void {
  currentLanguage = value;
  getRoot().lang = value;
  updateHiddenRoleLabel(value);

  document.getElementById('language-id')?.classList.toggle('active-lang', value === 'id');
  document.getElementById('language-en')?.classList.toggle('active-lang', value === 'en');

  document.querySelectorAll<HTMLImageElement>('[data-alt-id][data-alt-en]').forEach((image) => {
    image.alt = value === 'id' ? image.dataset.altId ?? '' : image.dataset.altEn ?? '';
  });

  document.querySelectorAll<HTMLElement>('.project-row').forEach((row) => {
    const title = row.querySelector<HTMLElement>('.row-title');
    const category = row.querySelector<HTMLElement>('.row-category [data-id][data-en]');
    const number = row.querySelector('.row-number')?.textContent?.trim() ?? '';
    const titleText = title ? localizedText(title, value) : '';
    const categoryText = category ? localizedText(category, value) : '';
    row.setAttribute(
      'aria-label',
      `${number}, ${titleText}, ${categoryText}. ${value === 'id' ? 'Buka proyek.' : 'Open project.'}`,
    );
  });

  document.getElementById('language-toggle')?.setAttribute(
    'aria-label',
    value === 'id'
      ? 'Bahasa Indonesia aktif. Switch to English.'
      : 'English active. Switch to Indonesian.',
  );
  document.getElementById('about-trigger')?.setAttribute(
    'aria-label',
    value === 'id' ? 'Tentang arsip PAW' : 'About the PAW archive',
  );
  document.querySelector('.brand-name')?.setAttribute(
    'aria-label',
    value === 'id' ? 'KXRUMII — halaman utama' : 'KXRUMII — home page',
  );
  document.querySelector('.archive-list')?.setAttribute(
    'aria-label',
    value === 'id' ? 'Daftar tugas PAW' : 'PAW project list',
  );

  document.title = value === 'id' ? 'KXRUMII — Arsip PAW' : 'KXRUMII — PAW Archive';
  document.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    value === 'id'
      ? 'Arsip tugas dan eksperimen mata kuliah Pengembangan Aplikasi Web.'
      : 'An archive of assignments and experiments from the Web Application Development course.',
  );

  const mood = getRoot().dataset.mood ?? null;
  setMood(isMood(mood) ? mood : 'dark');

  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch {
      // The selected language remains active for this page view.
    }
  }
}

function applyLanguageImmediately(value: Language, persist = false): void {
  allLanguageTargets().forEach((element) => {
    const text = localizedText(element, value);
    element.replaceChildren(languageContent(element, text));
    if (element.classList.contains('row-title')) element.dataset.lettersReady = 'true';
  });
  updateLanguageSemantics(value, persist);
}

function isFlowElement(element: HTMLElement): boolean {
  if (element.matches('.role-line, .row-title, .route-reveal-line')) return false;
  const display = window.getComputedStyle(element).display;
  return element.matches('h1, h2, h3, p, div') || ['block', 'flex', 'grid'].includes(display);
}

function restoreInlineStyles(
  element: HTMLElement,
  previous: {
    width: string;
    height: string;
    overflow: string;
    overflowX: string;
    overflowY: string;
    display: string;
  },
): void {
  element.style.width = previous.width;
  element.style.height = previous.height;
  element.style.overflow = previous.overflow;
  element.style.overflowX = previous.overflowX;
  element.style.overflowY = previous.overflowY;
  element.style.display = previous.display;
}

async function animateElementLanguageSwap(
  element: HTMLElement,
  nextValue: string,
  stagger: number,
): Promise<void> {
  const oldValue = element.textContent?.trim() ?? '';
  if (oldValue === nextValue) return;

  const oldRect = element.getBoundingClientRect();
  const oldWidth = Math.max(oldRect.width, 1);
  const oldHeight = Math.max(oldRect.height, 1);
  const previousStyles = {
    width: element.style.width,
    height: element.style.height,
    overflow: element.style.overflow,
    overflowX: element.style.overflowX,
    overflowY: element.style.overflowY,
    display: element.style.display,
  };
  const flow = isFlowElement(element);

  const oldLine = document.createElement('span');
  oldLine.className = 'language-swap-line language-swap-line--old';
  oldLine.append(...Array.from(element.childNodes));

  const newLine = document.createElement('span');
  newLine.className = 'language-swap-line language-swap-line--new';
  newLine.append(languageContent(element, nextValue));

  const stage = document.createElement('span');
  stage.className = `language-swap-stage${flow ? ' language-swap-stage--flow' : ''}`;
  stage.append(oldLine, newLine);

  if (window.getComputedStyle(element).display === 'inline') {
    element.style.display = 'inline-block';
  }
  // Clip only vertically. Keeping the horizontal axis visible lets a longer
  // translated title remain legible while its host width and category position
  // morph together; the clipped stage still creates the vertical text roll.
  element.style.overflowX = 'visible';
  element.style.overflowY = 'clip';
  element.style.width = `${oldWidth}px`;
  element.style.height = `${oldHeight}px`;
  element.replaceChildren(stage);
  void element.offsetHeight;

  const newRect = newLine.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
  const verticalPadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
  const newWidth = flow ? oldWidth : Math.max(newRect.width + horizontalPadding, 1);
  const newHeight = Math.max(newRect.height + verticalPadding, 1);

  // Both language lines occupy one clipped viewport. The old line exits upward
  // while the new line rises from below; the host geometry morphs at the same
  // time so the number/category layout follows the changing title width.
  oldLine.style.height = `${oldHeight}px`;
  newLine.style.height = `${newHeight}px`;
  oldLine.style.boxSizing = 'border-box';
  newLine.style.boxSizing = 'border-box';

  const trackAnimation = stage.animate(
    [
      { transform: 'translateY(0px)' },
      { transform: `translateY(-${oldHeight}px)` },
    ],
    {
      duration: LANGUAGE_DURATION,
      delay: stagger,
      easing: LANGUAGE_EASING,
      fill: 'both',
    },
  );
  const sizeAnimation = element.animate(
    [
      { width: `${oldWidth}px`, height: `${oldHeight}px` },
      { width: `${newWidth}px`, height: `${newHeight}px` },
    ],
    {
      duration: LANGUAGE_DURATION,
      delay: stagger,
      easing: LANGUAGE_EASING,
      fill: 'both',
    },
  );

  await Promise.allSettled([trackAnimation.finished, sizeAnimation.finished]);
  const finalNodes = Array.from(newLine.childNodes);
  element.replaceChildren(...finalNodes);
  // WAAPI fill effects remain active after `finished`; cancel them explicitly
  // so subsequent language swaps never inherit stale dimensions or transforms.
  trackAnimation.cancel();
  sizeAnimation.cancel();
  restoreInlineStyles(element, previousStyles);
  if (element.classList.contains('row-title')) element.dataset.lettersReady = 'true';
}

async function setLanguage(value: Language, persist = false, animate = false): Promise<void> {
  if (value === currentLanguage || languageTransitioning) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduced) {
    applyLanguageImmediately(value, persist);
    return;
  }

  languageTransitioning = true;
  const button = document.getElementById('language-toggle') as HTMLButtonElement | null;
  if (button) {
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
  }

  try {
    const targets = languageTargets();
    await Promise.all(
      targets.map((element, index) =>
        animateElementLanguageSwap(element, localizedText(element, value), Math.min(index * 12, 120)),
      ),
    );
    applyUntargetedLanguage(value, targets);
    updateLanguageSemantics(value, persist);
  } finally {
    languageTransitioning = false;
    button?.removeAttribute('aria-busy');
    if (button) button.disabled = false;
  }
}

function placeholderSvg(key: string, index: number): string {
  const isDark = index % 2 === 1;
  const background = isDark ? '#171717' : '#f4f1eb';
  const foreground = isDark ? '#f4f4f2' : '#171717';
  const muted = isDark ? '#85817a' : '#a09b91';
  const accents = ['#ad1519', '#d4c62a', '#6d8067', '#8d83ad'];
  const accent = accents[index % accents.length];
  const title = key.toUpperCase().replaceAll('-', ' ');
  let artwork = '';

  if (key.startsWith('music-')) {
    artwork = `<rect x="45" y="132" width="184" height="184" fill="${accent}"/><circle cx="352" cy="224" r="112" fill="#202020"/><circle cx="352" cy="224" r="85" fill="#303030"/><circle cx="352" cy="224" r="36" fill="${accent}"/><circle cx="352" cy="224" r="7" fill="#111"/>`;
  } else if (key.startsWith('portfolio-')) {
    artwork = `<rect x="45" y="132" width="184" height="184" fill="${accent}"/><rect x="245" y="132" width="190" height="82" fill="${muted}" opacity=".7"/><rect x="245" y="230" width="190" height="86" fill="${accent}" opacity=".48"/>`;
  } else if (key.startsWith('task-')) {
    artwork = `<rect x="45" y="138" width="390" height="34" rx="3" fill="${muted}" opacity=".22"/><rect x="45" y="187" width="390" height="34" rx="3" fill="${accent}" opacity=".82"/><rect x="45" y="236" width="390" height="34" rx="3" fill="${muted}" opacity=".3"/><rect x="45" y="285" width="184" height="31" rx="3" fill="${accent}" opacity=".38"/>`;
  } else {
    artwork = `<rect x="45" y="137" width="180" height="178" rx="2" fill="${accent}"/><rect x="245" y="137" width="190" height="82" fill="${muted}" opacity=".55"/><rect x="245" y="234" width="190" height="81" fill="${accent}" opacity=".34"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><rect width="480" height="360" fill="${background}"/><rect width="480" height="24" fill="${isDark ? '#242424' : '#e8e5df'}"/><circle cx="14" cy="12" r="3" fill="#d66"/><circle cx="26" cy="12" r="3" fill="#d4b34f"/><circle cx="38" cy="12" r="3" fill="#68a37a"/><rect x="45" y="48" width="86" height="7" rx="3" fill="${muted}"/><rect x="365" y="48" width="70" height="7" rx="3" fill="${muted}" opacity=".7"/><text x="45" y="103" fill="${foreground}" font-family="Arial,sans-serif" font-size="21" font-weight="600">${title}</text>${artwork}<rect x="45" y="337" width="92" height="5" rx="2" fill="${muted}" opacity=".55"/><text x="435" y="345" text-anchor="end" fill="${muted}" font-family="Arial,sans-serif" font-size="8">SCREENSHOT PENDING</text></svg>`;
}

function initPreviews(): void {
  document.querySelectorAll<HTMLElement>('[data-preview]').forEach((figure, index) => {
    const key = figure.dataset.preview ?? '';
    const image = figure.querySelector<HTMLImageElement>('img');
    if (!image) return;
    const preview = portalProjects.flatMap((project) => project.previews).find((item) => item.key === key);
    if (preview) image.alt = currentLanguage === 'id' ? preview.altId : preview.altEn;
    if (!image.getAttribute('src')) {
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg(key, index))}`;
    }
  });
}

function openAbout(): void {
  const panel = document.getElementById('about-panel');
  const overlay = document.getElementById('about-overlay');
  const trigger = document.getElementById('about-trigger');
  const closeButton = document.getElementById('about-close');
  if (!panel || !overlay || !trigger || !closeButton || getRoot().classList.contains('about-open')) return;

  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  getRoot().classList.add('about-open');
  panel.removeAttribute('inert');
  panel.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  trigger.setAttribute('aria-expanded', 'true');

  document.querySelectorAll('.site-header, .archive-main, .site-footer, .skip-link').forEach((element) => {
    element.setAttribute('inert', '');
  });
  requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
}

function closeAbout(): void {
  if (!getRoot().classList.contains('about-open')) return;
  const panel = document.getElementById('about-panel');
  const overlay = document.getElementById('about-overlay');
  const trigger = document.getElementById('about-trigger');

  getRoot().classList.remove('about-open');
  panel?.setAttribute('inert', '');
  panel?.setAttribute('aria-hidden', 'true');
  overlay?.setAttribute('aria-hidden', 'true');
  trigger?.setAttribute('aria-expanded', 'false');

  document.querySelectorAll('.site-header, .archive-main, .site-footer, .skip-link').forEach((element) => {
    element.removeAttribute('inert');
  });
  previousFocus?.focus({ preventScroll: true });
}

function isPortalContentPrepared(language: Language): boolean {
  const textTargetsAreCorrect = allLanguageTargets().every((element) =>
    element.textContent?.trim() === localizedText(element, language).trim(),
  );
  if (!textTargetsAreCorrect) return false;

  const hasLetterMarkup = (selector: string, childSelector: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).every((element) =>
      Boolean(element.querySelector(childSelector)),
    );

  return (
    hasLetterMarkup('.row-title', '.letter') &&
    hasLetterMarkup('.role-line', '.role-letter') &&
    hasLetterMarkup('.about-title', '.about-title-letter') &&
    hasLetterMarkup('.about-copy p, .about-secondary p', '.about-word')
  );
}

function initializePortalPage(): void {
  if (!document.querySelector('.archive-main')) return;

  let initialMood: Mood = 'dark';
  let initialLanguage: Language = getRoot().lang === 'en' ? 'en' : 'id';
  try {
    const savedMood = localStorage.getItem(MOOD_STORAGE_KEY);
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isMood(savedMood)) initialMood = savedMood;
    if (savedLanguage === 'id' || savedLanguage === 'en') initialLanguage = savedLanguage;
  } catch {
    // Keep the default Dark / Indonesian state without browser storage.
  }

  setMood(initialMood);
  if (isPortalContentPrepared(initialLanguage)) {
    // The transition module pre-localizes a detached Portal document before
    // swap. Do not rebuild its text nodes while the entrance animation runs.
    currentLanguage = initialLanguage;
    updateLanguageSemantics(initialLanguage, false);
  } else {
    applyLanguageImmediately(initialLanguage);
  }
  initPreviews();
}

function handlePortalClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (target.closest('#mood-toggle')) {
    const currentMood = getRoot().dataset.mood ?? null;
    const selectedMood: Mood = isMood(currentMood) ? currentMood : 'dark';
    const currentIndex = moodOrder.indexOf(selectedMood);
    setMood(moodOrder[(currentIndex + 1) % moodOrder.length], true);
    return;
  }

  if (target.closest('#language-toggle')) {
    void setLanguage(currentLanguage === 'id' ? 'en' : 'id', true, true);
    return;
  }

  if (target.closest('#about-trigger')) {
    openAbout();
    return;
  }

  if (target.closest('#about-close, #about-overlay')) closeAbout();
}

function handlePortalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeAbout();
    return;
  }
  if (event.key !== 'Tab' || !getRoot().classList.contains('about-open')) return;

  const panel = document.getElementById('about-panel');
  if (!panel) return;
  const focusable = Array.from(
    panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

const portalWindow = window as Window & { __kxrumiiPortalListenersInstalled?: boolean };
if (!portalWindow.__kxrumiiPortalListenersInstalled) {
  portalWindow.__kxrumiiPortalListenersInstalled = true;
  document.addEventListener('click', handlePortalClick);
  document.addEventListener('keydown', handlePortalKeydown);
  document.addEventListener('astro:page-load', initializePortalPage);
}
initializePortalPage();
