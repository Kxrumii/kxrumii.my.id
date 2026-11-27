import type { Work } from '../types';
import { WorkList } from './WorkList';

interface ListViewProps {
  works: Work[];
  activeSlug: string | null;
  onActivate: (slug: string) => void;
}

/** Huy's centred index: the active entry at full strength, the others faded. Scrolls inside its own region. */
export function ListView({ works, activeSlug, onActivate }: ListViewProps) {
  return (
    <div className="list-view">
      <WorkList works={works} activeSlug={activeSlug} onActivate={onActivate} />
    </div>
  );
}
