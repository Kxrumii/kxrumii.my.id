import { useId, type ChangeEvent } from 'react';
import { CATEGORY_LABELS } from '../data/works';
import type { CategoryFilter, WorkCategory } from '../types';

interface FilterBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  /** Categories that exist in the data; "All" is always offered. */
  categories: WorkCategory[];
  resultCount: number;
}

/** Controlled search box and category chips. State lives in the parent. */
export function FilterBar({ query, onQueryChange, category, onCategoryChange, categories, resultCount }: FilterBarProps) {
  const inputId = useId();
  const options: CategoryFilter[] = ['all', ...categories];

  return (
    <div className="filter-bar">
      <div className="filter-search">
        <label className="visually-hidden" htmlFor={inputId}>
          Cari karya
        </label>
        <input
          id={inputId}
          type="search"
          placeholder="Cari karya…"
          autoComplete="off"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="filter-chips" role="group" aria-label="Filter kategori">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={category === option}
            onClick={() => onCategoryChange(option)}
          >
            {option === 'all' ? 'All' : CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>
      <p className="filter-count" role="status">
        {resultCount} karya
      </p>
    </div>
  );
}
