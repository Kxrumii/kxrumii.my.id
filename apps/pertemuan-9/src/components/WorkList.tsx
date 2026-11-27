import type { KeyboardEvent } from 'react';
import type { Work } from '../types';
import { WorkRow } from './WorkRow';

interface WorkListProps {
  works: Work[];
  activeSlug: string | null;
  onActivate: (slug: string) => void;
}

/** Ordered list of rows. ArrowUp/ArrowDown move focus (and so the active item) between rows. */
export function WorkList({ works, activeSlug, onActivate }: WorkListProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a.work-row-link'));
    const current = (event.target as Element).closest('a.work-row-link') as HTMLAnchorElement | null;
    const index = current ? links.indexOf(current) : -1;
    if (index === -1) return;

    const next = links[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return; // at either end: leave the key to the browser (page scroll)
    event.preventDefault();
    next.focus();
  }

  return (
    <ol className="work-list" aria-label="Daftar karya" onKeyDown={handleKeyDown}>
      {works.map((work, index) => (
        <WorkRow key={work.slug} work={work} index={index} active={work.slug === activeSlug} onActivate={onActivate} />
      ))}
    </ol>
  );
}
