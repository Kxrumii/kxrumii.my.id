import {
  EASE_OUT,
  animateElement,
  canAnimate,
  type AnimationLike,
} from './motion.ts';

export interface AccordionController {
  flush(): void;
  destroy(): void;
}

interface ActiveAccordionState {
  phase: 'expanding' | 'closing';
  token: number;
  anim: AnimationLike | null;
  bodyAnim: AnimationLike | null;
}

function safeCancel(anim: AnimationLike | null | undefined): void {
  if (!anim) return;
  try {
    anim.cancel();
  } catch {
    /* animasi mungkin sudah selesai atau dibatalkan */
  }
}

function measureHeight(el: HTMLElement): number {
  const rectH = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect().height : 0;
  return rectH > 0 ? rectH : el.offsetHeight || 0;
}

/**
 * Progressive-enhancement WAAPI untuk `<details class="note">` native pada halaman Dokumentasi:
 * mempertahankan semantik & aktivasi keyboard `<summary>`, bekerja konsisten di Zen (Firefox)
 * dan Brave (Chromium), serta langsung fallback ke toggle native bila gerak dinonaktifkan.
 */
export function initDocAccordions(root: ParentNode = document): AccordionController {
  const active = new Map<HTMLDetailsElement, ActiveAccordionState>();
  const cleanups: Array<() => void> = [];
  let tokenCounter = 0;

  function clearStyles(details: HTMLDetailsElement): void {
    delete details.dataset.accordionState;
    details.style.overflow = '';
    details.style.height = '';
  }

  function settleOne(details: HTMLDetailsElement, state: ActiveAccordionState, commitOpen: boolean): void {
    active.delete(details);
    safeCancel(state.anim);
    safeCancel(state.bodyAnim);
    details.open = commitOpen;
    clearStyles(details);
  }

  for (const details of Array.from(root.querySelectorAll<HTMLDetailsElement>('details.note'))) {
    const summary = details.querySelector<HTMLElement>('summary');
    const body = details.querySelector<HTMLElement>('.note-body');
    if (!summary || !body) continue;

    const onSummaryClick = (event: MouseEvent): void => {
      const current = active.get(details);
      const isExpanding = !details.open || current?.phase === 'closing';

      if (!canAnimate() || typeof details.animate !== 'function') {
        if (current) {
          settleOne(details, current, isExpanding);
          event.preventDefault();
        }
        return;
      }

      event.preventDefault();
      const startHeight = measureHeight(details);
      const token = ++tokenCounter;

      if (current) {
        active.delete(details);
        safeCancel(current.anim);
        safeCancel(current.bodyAnim);
      }

      if (isExpanding) {
        clearStyles(details);
        details.open = true;
        const measuredExpanded = measureHeight(details) || details.scrollHeight;
        const endHeight =
          measuredExpanded > startHeight
            ? measuredExpanded
            : Math.max(startHeight, measureHeight(summary) + measureHeight(body));

        if (Math.abs(endHeight - startHeight) <= 1) {
          clearStyles(details);
          return;
        }

        details.style.overflow = 'hidden';
        const anim = animateElement(
          'accordion',
          details,
          [{ height: `${startHeight.toFixed(1)}px` }, { height: `${endHeight.toFixed(1)}px` }],
          { duration: 240, easing: EASE_OUT, fill: 'none' },
        );
        const bodyAnim = animateElement(
          'accordion',
          body,
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 180, easing: EASE_OUT, fill: 'backwards' },
        );

        if (!anim) {
          safeCancel(bodyAnim);
          clearStyles(details);
          return;
        }

        const state: ActiveAccordionState = { phase: 'expanding', token, anim, bodyAnim };
        active.set(details, state);
        void Promise.resolve(anim.finished).then(
          () => {
            if (active.get(details)?.token !== token) return;
            settleOne(details, state, true);
          },
          () => {
            if (active.get(details)?.token === token) {
              active.delete(details);
              clearStyles(details);
            }
          },
        );
      } else {
        details.dataset.accordionState = 'closing';
        const summaryHeight = measureHeight(summary);
        if (startHeight <= 0 || Math.abs(startHeight - summaryHeight) <= 1) {
          details.open = false;
          clearStyles(details);
          return;
        }

        details.style.overflow = 'hidden';
        const anim = animateElement(
          'accordion',
          details,
          [{ height: `${startHeight.toFixed(1)}px` }, { height: `${summaryHeight.toFixed(1)}px` }],
          { duration: 200, easing: EASE_OUT, fill: 'forwards' },
        );
        const bodyAnim = animateElement(
          'accordion',
          body,
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 140, easing: EASE_OUT, fill: 'forwards' },
        );

        if (!anim) {
          safeCancel(bodyAnim);
          details.open = false;
          clearStyles(details);
          return;
        }

        const state: ActiveAccordionState = { phase: 'closing', token, anim, bodyAnim };
        active.set(details, state);
        void Promise.resolve(anim.finished).then(
          () => {
            if (active.get(details)?.token !== token) return;
            settleOne(details, state, false);
          },
          () => {
            if (active.get(details)?.token === token) {
              active.delete(details);
              clearStyles(details);
            }
          },
        );
      }
    };

    summary.addEventListener('click', onSummaryClick);
    cleanups.push(() => summary.removeEventListener('click', onSummaryClick));
  }

  return {
    flush(): void {
      for (const [details, state] of Array.from(active.entries())) {
        settleOne(details, state, state.phase === 'expanding');
      }
    },
    destroy(): void {
      this.flush();
      for (const unbind of cleanups) {
        unbind();
      }
    },
  };
}
