import { CATEGORY_LABELS } from '../data/works';
import type { CategoryFilter, Work } from '../types';

/** Case-insensitive search over title, summary, category label and year, narrowed by category. */
export function filterWorks(items: Work[], query: string, category: CategoryFilter): Work[] {
  const needle = query.trim().toLowerCase();

  return items.filter((work) => {
    if (category !== 'all' && work.category !== category) return false;
    if (needle === '') return true;
    const haystack = [work.title, work.summary, CATEGORY_LABELS[work.category], work.year ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}
