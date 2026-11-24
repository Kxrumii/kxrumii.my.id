import type { ReactNode } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';

interface StageProps {
  /** Stable identifier used for styling and test hooks (`data-page`). */
  name: string;
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}

/** Route content frame: the only part that moves during same-document transitions. */
export function Stage({ name, title, eyebrow, children }: StageProps) {
  usePageTitle(title);

  return (
    <section className="stage" data-page={name} data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
      {eyebrow ? <p className="ui-label">{eyebrow}</p> : null}
      <h1 className="stage-title">{title}</h1>
      {children}
    </section>
  );
}
