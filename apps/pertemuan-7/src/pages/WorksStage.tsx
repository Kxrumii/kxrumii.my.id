import { useEffect, useRef, useState } from 'react';
import { useSound } from '../audio/useSound';
import { EmptyState } from '../components/EmptyState';
import { FilterBar } from '../components/FilterBar';
import { IndexNumeral } from '../components/IndexNumeral';
import { ListView } from '../components/ListView';
import { SpiralView } from '../components/SpiralView';
import { ViewToggle, type WorksView } from '../components/ViewToggle';
import { WorkInfo } from '../components/WorkInfo';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { transitionIndex } from '../transition';
import type { CategoryFilter } from '../types';
import { filterWorks } from '../utils/filterWorks';

// Static data, so the available categories are computed once.
const categories = Array.from(new Set(works.map((work) => work.category)));

/**
 * Works stage: Pacôme's spiral/list flow composed on Huy's grid
 * (filters on top, active-work metadata left, giant index bottom-left).
 * Filter, view and active work are plain useState; everything else is derived.
 */
export function WorksStage() {
  usePageTitle('Selected Work');
  const { play } = useSound();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<WorksView>('spiral');
  const [activeSlug, setActiveSlug] = useState<string | null>(works[0]?.slug ?? null);
  const viewRef = useRef<HTMLDivElement>(null);
  const switching = useRef(false);

  const visibleWorks = filterWorks(works, query, category);
  // If the active work was filtered out, the first visible one takes over.
  const activeWork = visibleWorks.find((work) => work.slug === activeSlug) ?? visibleWorks[0] ?? null;
  const activeIndex = activeWork ? visibleWorks.indexOf(activeWork) : -1;

  // One tick per real change of the active work (never per animation frame).
  const lastActive = useRef<string | null>(activeWork?.slug ?? null);
  useEffect(() => {
    const slug = activeWork?.slug ?? null;
    if (slug === lastActive.current) return;
    if (lastActive.current !== null && slug !== null) play('tick');
    lastActive.current = slug;
  }, [activeWork?.slug, play]);

  async function changeView(next: WorksView) {
    if (next === view || switching.current) return;
    switching.current = true;
    play('switch');
    const current = viewRef.current;
    if (current && !reducedMotion) {
      // Opacity + transform only: the spiral's 3D chain must never get a filter.
      const leave = current.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: view === 'spiral' ? 'scale(0.92)' : 'translate3d(0, -2vh, 0)' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
      );
      await leave.finished.catch(() => undefined);
    }
    setView(next);
    switching.current = false;
  }

  function resetFilters() {
    setQuery('');
    setCategory('all');
  }

  return (
    <section className="stage works-stage" data-page="work">
      <h1 className="visually-hidden">Selected Work</h1>
      <div className="works-controls" data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          resultCount={visibleWorks.length}
        />
        <ViewToggle view={view} onChange={changeView} />
      </div>
      <WorkInfo work={activeWork} />
      <IndexNumeral index={activeIndex} total={visibleWorks.length} />
      <div
        className="works-view"
        data-view={view}
        data-transition-exit=""
        data-transition-enter=""
        data-transition-motion="depth"
        style={transitionIndex(1)}
      >
        {visibleWorks.length === 0 ? (
          <EmptyState
            title="Tidak ada karya yang cocok"
            description="Coba kata kunci lain atau tampilkan semua kategori."
            actionLabel="Reset filter"
            onAction={resetFilters}
          />
        ) : (
          <div className="works-view-inner" key={view} ref={viewRef}>
            {view === 'spiral' ? (
              <SpiralView works={visibleWorks} activeSlug={activeWork?.slug ?? null} onActivate={setActiveSlug} />
            ) : (
              <ListView works={visibleWorks} activeSlug={activeWork?.slug ?? null} onActivate={setActiveSlug} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
