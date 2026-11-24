import type { ReactNode } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';

interface PageProps {
  /** Stable identifier used for styling and test hooks (`data-page`). */
  name: string;
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}

/** Shared page frame: transition participation, title sync and the page heading. */
export function Page({ name, title, eyebrow, children }: PageProps) {
  usePageTitle(title);

  return (
    <section className="page" data-page={name} data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {children}
    </section>
  );
}
