import {
  MORPH_PRESETS,
  MORPH_SPECS,
  interpolateShape,
  perforationKeyframes,
  shapeDistance,
  toClipPath,
  type MorphEasing,
  type MorphShape,
  type MorphSpecKey,
} from './morphShapes';

/*
 * Shape Morph runner (DOM + WAAPI). The only writer of `clip-path` on a mask element and of `opacity` on its
 * perforation overlay (`[data-morph-perforation]`). It never touches transform, so it cannot clash with the camera
 * renderer, the sheet FLIP, or the Transition Bridge.
 *
 * One animation per mask. A new request on a mask that is still animating continues from the shape reached so far
 * (a same-context reversal such as hover enter/leave therefore never jumps), cancelling the old animation first.
 * Ending on the `frame` shape removes the inline style entirely (the natural, unclipped state).
 */

export type MorphResult = 'finished' | 'cancelled';

export interface MorphHandle {
  finished: Promise<MorphResult>;
  cancel(): void;
}

export interface MorphOptions {
  /** Start shape; defaults to the shape the mask is currently in. */
  from?: MorphShape;
  /** Jump straight to the end shape. */
  reducedMotion?: boolean;
}

interface Running {
  clip: Animation;
  perforation: Animation | null;
  from: MorphShape;
  to: MorphShape;
}

const running = new WeakMap<HTMLElement, Running>();
const resting = new WeakMap<HTMLElement, MorphShape>();

const FALLBACK_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function easingCss(easing: MorphEasing): string {
  if (easing === 'in-out') return 'cubic-bezier(0.45, 0, 0.2, 1)';
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue(easing === 'spring' ? '--ease-spring' : '--ease-out').trim() || FALLBACK_EASE;
}

const perforationOf = (mask: HTMLElement) => mask.querySelector<HTMLElement>('[data-morph-perforation]');

function release(mask: HTMLElement): void {
  const entry = running.get(mask);
  entry?.clip.cancel();
  entry?.perforation?.cancel();
  running.delete(mask);
}

function clear(mask: HTMLElement): void {
  release(mask);
  mask.style.removeProperty('clip-path');
  perforationOf(mask)?.style.removeProperty('opacity');
  resting.set(mask, MORPH_PRESETS.frame);
}

/** Shape the mask is in right now (interpolated while an animation is running). */
export function currentShape(mask: HTMLElement): MorphShape {
  const entry = running.get(mask);
  if (!entry) return resting.get(mask) ?? MORPH_PRESETS.frame;
  const progress = entry.clip.effect?.getComputedTiming().progress;
  return interpolateShape(entry.from, entry.to, typeof progress === 'number' ? progress : 0);
}

/** Cancels any morph and returns the mask to its natural (unclipped) state. */
export function cancelMorph(mask: HTMLElement): void {
  clear(mask);
}

export function playMorph(mask: HTMLElement, key: MorphSpecKey, options: MorphOptions = {}): MorphHandle {
  const spec = MORPH_SPECS[key];
  const to = MORPH_PRESETS[spec.to];
  const toFrame = spec.to === 'frame';
  const from = options.from ?? currentShape(mask);
  release(mask);

  if (options.reducedMotion || typeof mask.animate !== 'function') {
    if (toFrame) clear(mask);
    else {
      mask.style.clipPath = toClipPath(to);
      const overlay = perforationOf(mask);
      if (overlay) overlay.style.opacity = String(to.perforation);
      resting.set(mask, to);
    }
    return { finished: Promise.resolve('finished'), cancel() {} };
  }

  const full = shapeDistance(MORPH_PRESETS[spec.from], to);
  const ratio = full > 0 ? Math.min(Math.max(shapeDistance(from, to) / full, 0.35), 1) : 1;
  const timing: KeyframeAnimationOptions = { duration: Math.round(spec.durationMs * ratio), easing: easingCss(spec.easing), fill: 'forwards' };

  // Hold the start shape until the animation takes over, so a mask that starts clipped never flashes unclipped.
  mask.style.clipPath = toClipPath(from);
  const clip = mask.animate([{ clipPath: toClipPath(from) }, { clipPath: toClipPath(to) }], timing);
  const overlay = perforationOf(mask);
  const perforation = overlay
    ? overlay.animate(
        perforationKeyframes(from.perforation, to.perforation).map(({ offset, opacity }) => ({ offset, opacity })),
        timing,
      )
    : null;

  const entry: Running = { clip, perforation, from, to };
  running.set(mask, entry);

  const finished = clip.finished.then(
    (): MorphResult => {
      if (running.get(mask) === entry) {
        if (toFrame) clear(mask);
        else resting.set(mask, to);
      }
      return 'finished';
    },
    (): MorphResult => 'cancelled',
  );

  return {
    finished,
    cancel() {
      if (running.get(mask) === entry) clear(mask);
    },
  };
}
