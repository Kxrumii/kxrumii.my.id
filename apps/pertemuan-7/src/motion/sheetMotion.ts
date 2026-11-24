/*
 * Open/close choreography for the work sheet — compositor-only (transform + opacity).
 *
 * Layers inside the transparent <dialog>:
 *   .sheet-card            the sheet's background card (scales from the origin, fades)
 *   [data-sheet-hero]      the element that travels between the stage and the sheet:
 *                          "media" when opened from the spiral, "title" when opened from the list
 *   [data-sheet-reveal]    everything else: fades in with a small rise, fades out first
 *
 * Origin modes:
 *   spiral  the hero media flies from the orbit card (uniform scale, centre to centre)
 *   list    the hero title flies from the row title (uniform scale, transform-origin top left)
 *   none    direct load, Back/Forward or no usable origin: the whole dialog fades with scale .96 -> 1
 *
 * Closing ends with every visible layer (backdrop included, via CSS) at opacity 0 and holds that
 * state (fill: forwards, then an inline opacity 0 on the dialog) until React unmounts it, so no
 * frame can snap back to the open state.
 */
export type OriginMode = 'spiral' | 'list';

const OPEN_MS = 600;
const CLOSE_MS = 380;
const FALLBACK_OPEN_MS = 420;
const FALLBACK_CLOSE_MS = 260;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.45, 0, 0.2, 1)';

const round = (value: number) => Math.round(value * 1000) / 1000;
/** Font size of the list title the sheet title travels from (set right before measuring). */
let originFontSize = 16;

const spring = () => getComputedStyle(document.documentElement).getPropertyValue('--ease-spring').trim() || EASE_OUT;

interface SheetParts {
  dialog: HTMLElement;
  card: HTMLElement;
  hero: HTMLElement | null;
  reveals: HTMLElement[];
}

function usable(rect: DOMRect | null): rect is DOMRect {
  return (
    !!rect &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 8 &&
    rect.height > 8 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

/** Rect of the stage element the sheet travels from/to: the orbit card, or the row's title text. */
export function originRect(slug: string, mode: OriginMode | null): DOMRect | null {
  if (!mode) return null;
  const row = document.querySelector<HTMLElement>(`[data-work-slug="${CSS.escape(slug)}"]`);
  const el = mode === 'list' ? row?.querySelector<HTMLElement>('[data-work-title]') : row;
  if (!el || getComputedStyle(el).visibility === 'hidden') return null;
  const rect = el.getBoundingClientRect();
  return usable(rect) ? rect : null;
}

function partsOf(dialog: HTMLElement, mode: OriginMode | null): SheetParts | null {
  const card = dialog.querySelector<HTMLElement>('.sheet-card');
  if (!card) return null;
  const hero = mode ? dialog.querySelector<HTMLElement>(`[data-sheet-hero="${mode === 'spiral' ? 'media' : 'title'}"]`) : null;
  // The hero of the other mode is just one more piece of content.
  const reveals = Array.from(dialog.querySelectorAll<HTMLElement>('[data-sheet-reveal], [data-sheet-hero]')).filter((el) => el !== hero);
  return { dialog, card, hero, reveals };
}

/** Transform that places the hero (natural rect `to`) over the origin rect, scaled uniformly. */
function heroTransform(hero: HTMLElement, mode: OriginMode, origin: DOMRect): string {
  const to = hero.getBoundingClientRect();
  if (mode === 'list') {
    // Same uniform factor for X and Y: the font-size ratio (never a stretch), anchored top-left.
    const s = Number.parseFloat(getComputedStyle(hero).fontSize) || 1;
    return `translate3d(${round(origin.left - to.left)}px, ${round(origin.top - to.top)}px, 0) scale(${round(originFontSize / s)})`;
  }
  const scale = origin.width / Math.max(to.width, 1);
  const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
  const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
  return `translate3d(${round(dx)}px, ${round(dy)}px, 0) scale(${round(scale)})`;
}

/** Card scale start and its transform-origin pointing at the origin's centre. */
function prepareCard(card: HTMLElement, origin: DOMRect): number {
  const box = card.getBoundingClientRect();
  card.style.transformOrigin = `${round(origin.left + origin.width / 2 - box.left)}px ${round(origin.top + origin.height / 2 - box.top)}px`;
  return round(Math.min(Math.max(origin.width / Math.max(box.width, 1), 0.3), 0.9));
}

function setOriginFont(slug: string, mode: OriginMode) {
  if (mode !== 'list') return;
  const title = document.querySelector<HTMLElement>(`[data-work-slug="${CSS.escape(slug)}"] [data-work-title]`);
  originFontSize = Number.parseFloat(title ? getComputedStyle(title).fontSize : '') || 16;
}

/** Starts the open motion right after showModal(); every animation ends in the natural state. */
export function playSheetOpen(dialog: HTMLElement, slug: string, mode: OriginMode | null, origin: DOMRect | null): Animation[] {
  const parts = partsOf(dialog, origin ? mode : null);
  if (!parts || !origin || !mode || !parts.hero) {
    return [
      dialog.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], {
        duration: FALLBACK_OPEN_MS,
        easing: EASE_OUT,
        fill: 'backwards',
      }),
    ];
  }
  setOriginFont(slug, mode);
  const { card, hero, reveals } = parts;
  if (mode === 'list') hero.style.transformOrigin = '0 0';
  const from = heroTransform(hero, mode, origin);
  const cardScale = prepareCard(card, origin);
  const animations = [
    hero.animate([{ transform: from }, { transform: 'none' }], { duration: OPEN_MS, easing: spring(), fill: 'backwards' }),
    card.animate(
      [
        { opacity: 0, transform: `scale(${cardScale})` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: OPEN_MS - 60, delay: 50, easing: spring(), fill: 'backwards' },
    ),
  ];
  reveals.forEach((el, index) => {
    animations.push(
      el.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 420, delay: 200 + index * 40, easing: EASE_OUT, fill: 'backwards' },
      ),
    );
  });
  return animations;
}

/**
 * Plays the close motion and resolves once everything is fully transparent.
 * The end state is held (fill: forwards + inline opacity 0) until the dialog unmounts.
 */
export async function playSheetClose(dialog: HTMLElement, slug: string, mode: OriginMode | null, origin: DOMRect | null): Promise<void> {
  const parts = partsOf(dialog, origin ? mode : null);
  const animations: Animation[] = [];
  // Opacity runs linearly on its own animation, separate from the curved transform, so the fade is spread evenly
  // over every frame (a curved fade concentrates the drop into a couple of frames at low frame rates).
  const fade = (el: HTMLElement, duration: number, holdUntil = 0, delay = 0) =>
    el.animate(
      holdUntil > 0 ? [{ opacity: 1 }, { opacity: 1, offset: holdUntil }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration, delay, easing: 'linear', fill: 'forwards' },
    );
  if (!parts || !origin || !mode || !parts.hero) {
    animations.push(
      fade(dialog, FALLBACK_CLOSE_MS),
      dialog.animate([{ transform: 'none' }, { transform: 'scale(0.97)' }], { duration: FALLBACK_CLOSE_MS, easing: EASE_IN, fill: 'forwards' }),
    );
  } else {
    setOriginFont(slug, mode);
    const { card, hero, reveals } = parts;
    if (mode === 'list') hero.style.transformOrigin = '0 0';
    const to = heroTransform(hero, mode, origin);
    const cardScale = prepareCard(card, origin);
    reveals.forEach((el) => {
      animations.push(
        fade(el, 200),
        el.animate([{ transform: 'none' }, { transform: 'translate3d(0, 8px, 0)' }], { duration: 200, easing: EASE_IN, fill: 'forwards' }),
      );
    });
    animations.push(
      fade(card, CLOSE_MS - 40, 0, 40),
      card.animate([{ transform: 'none' }, { transform: `scale(${cardScale})` }], { duration: CLOSE_MS - 40, delay: 40, easing: EASE_IN, fill: 'forwards' }),
      // The hero stays solid briefly while it starts travelling, then fades evenly until it lands on the origin.
      fade(hero, CLOSE_MS + 40, 0.2),
      hero.animate([{ transform: 'none' }, { transform: to }], { duration: CLOSE_MS + 40, easing: 'cubic-bezier(0.33, 0, 0.25, 1)', fill: 'forwards' }),
    );
  }
  // The backdrop fades through CSS (`[data-closing]::backdrop`); wait for it too, so the dim never pops on unmount.
  const backdrop = document
    .getAnimations()
    .filter((a) => a.effect instanceof KeyframeEffect && a.effect.target === dialog && a.effect.pseudoElement === '::backdrop');
  await Promise.allSettled([...animations, ...backdrop].map((animation) => animation.finished));
  // Everything is already at 0; pin it so nothing can reappear before React removes the dialog.
  dialog.style.opacity = '0';
}
