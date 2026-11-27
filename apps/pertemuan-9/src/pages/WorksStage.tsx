import { useEffect, useRef, useState } from 'react';
import { Outlet, useMatch } from 'react-router';
import { useSound } from '../audio/useSound';
import { EmptyState } from '../components/EmptyState';
import { FilterBar } from '../components/FilterBar';
import { GalleryView } from '../components/GalleryView';
import { ListView } from '../components/ListView';
import { ViewToggle, type WorksView } from '../components/ViewToggle';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { transitionIndex } from '../transition';
import type { CategoryFilter } from '../types';
import { filterWorks } from '../utils/filterWorks';

// Static data, so the available categories are computed once.
const categories = Array.from(new Set(works.map((work) => work.category)));

/**
 * Works stage with two modes over one curated data source:
 *  - Gallery (default): the full-viewport CSS 2.5D room, always the whole collection (its camera choreography is
 *    authored per work, so it is never filtered). No index, no side panel.
 *  - List: numbered rows with search and category filter.
 * Filter, view and active work are plain useState; everything else is derived.
 *
 * It is also the parent route of `work/:slug`: the work sheet renders through <Outlet /> as an overlay, so opening
 * or closing it never unmounts the stage and view mode, filters and the active work survive.
 */
export function WorksStage() {
  const sheetSlug = useMatch('/work/:slug')?.params.slug ?? null;
  const sheetOpen = sheetSlug !== null;
  const sheetWork = sheetSlug ? works.find((work) => work.slug === sheetSlug) ?? null : null;
  // The stage owns document.title for itself and for the sheet, so the title is
  // restored by construction when the sheet closes (Back included).
  usePageTitle(sheetOpen ? (sheetWork ? sheetWork.title : 'Karya tidak ditemukan') : 'Selected Work');
  const { play } = useSound();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<WorksView>('gallery');
  const [activeSlug, setActiveSlug] = useState<string | null>(sheetWork?.slug ?? works[0]?.slug ?? null);
  const viewRef = useRef<HTMLDivElement>(null);
  const switching = useRef(false);

  const visibleWorks = filterWorks(works, query, category);
  // If the active work was filtered out of the list, the first visible one takes over.
  const listActive = visibleWorks.find((work) => work.slug === activeSlug) ?? visibleWorks[0] ?? null;

  // Opening a work (link, Back/Forward) makes it the active one.
  const sheetWorkSlug = sheetWork?.slug ?? null;
  useEffect(() => {
    if (sheetWorkSlug) setActiveSlug(sheetWorkSlug);
  }, [sheetWorkSlug]);

  // One tick per real change of the active work (never per animation frame).
  const lastActive = useRef<string | null>(activeSlug);
  useEffect(() => {
    if (activeSlug === lastActive.current) return;
    if (lastActive.current !== null && activeSlug !== null) play('tick');
    lastActive.current = activeSlug;
  }, [activeSlug, play]);

  async function changeView(next: WorksView) {
    if (next === view || switching.current) return;
    switching.current = true;
    play('switch');
    const current = viewRef.current;
    if (current && !reducedMotion) {
      // Opacity + transform only, on the wrapper above the 3D chain: the room itself never gets a filter.
      const leave = current.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: view === 'gallery' ? 'scale(0.92)' : 'translate3d(0, -2vh, 0)' },
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
    <section className="stage works-stage" data-page="work" data-view={view}>
      <h1 className="visually-hidden">Selected Work</h1>
      <div className="works-controls" data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
        {view === 'list' ? (
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            resultCount={visibleWorks.length}
          />
        ) : null}
        <ViewToggle view={view} onChange={changeView} />
      </div>
      <div
        className="works-view"
        data-view={view}
        data-transition-exit=""
        data-transition-enter=""
        data-transition-motion="depth"
        style={transitionIndex(1)}
      >
        {view === 'gallery' ? (
          <div className="works-view-inner" key="gallery" ref={viewRef}>
            <GalleryView works={works} initialSlug={activeSlug} suspended={sheetOpen} onFocusChange={setActiveSlug} />
          </div>
        ) : visibleWorks.length === 0 ? (
          <EmptyState
            title="Tidak ada karya yang cocok"
            description="Coba kata kunci lain atau tampilkan semua kategori."
            actionLabel="Reset filter"
            onAction={resetFilters}
          />
        ) : (
          <div className="works-view-inner" key="list" ref={viewRef}>
            <ListView works={visibleWorks} activeSlug={listActive?.slug ?? null} onActivate={setActiveSlug} />
          </div>
        )}
      </div>
      <Outlet />
    </section>
  );
}
