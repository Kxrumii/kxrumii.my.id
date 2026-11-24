import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { FilterBar } from '../components/FilterBar';
import { Stage } from '../components/Stage';
import { WorkList } from '../components/WorkList';
import { WorkPreview } from '../components/WorkPreview';
import { works } from '../data/works';
import type { CategoryFilter } from '../types';
import { filterWorks } from '../utils/filterWorks';

// Static data, so the available categories are computed once.
const categories = Array.from(new Set(works.map((work) => work.category)));

export function WorkPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [activeSlug, setActiveSlug] = useState<string | null>(works[0]?.slug ?? null);

  const visibleWorks = filterWorks(works, query, category);
  // The active item is derived: if it was filtered out, fall back to the first visible one.
  const activeWork = visibleWorks.find((work) => work.slug === activeSlug) ?? visibleWorks[0] ?? null;

  function resetFilters() {
    setQuery('');
    setCategory('all');
  }

  return (
    <Stage name="work" title="Selected Work" eyebrow="WORK">
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        resultCount={visibleWorks.length}
      />
      {activeWork ? (
        <div className="work-layout">
          <WorkList works={visibleWorks} activeSlug={activeWork.slug} onActivate={setActiveSlug} />
          <WorkPreview work={activeWork} />
        </div>
      ) : (
        <EmptyState
          title="Tidak ada karya yang cocok"
          description="Coba kata kunci lain atau tampilkan semua kategori."
          actionLabel="Reset filter"
          onAction={resetFilters}
        />
      )}
    </Stage>
  );
}
