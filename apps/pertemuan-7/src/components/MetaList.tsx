import type { ReactNode } from 'react';

export interface MetaItem {
  label: string;
  value: ReactNode;
}

interface MetaListProps {
  items: MetaItem[];
}

/** Label/value pairs as a description list; reused by the preview and the detail page. */
export function MetaList({ items }: MetaListProps) {
  return (
    <dl className="meta-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
