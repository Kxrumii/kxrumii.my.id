import { useEffect } from 'react';

const SUFFIX = 'Fahrii ✲ Showreel — Pertemuan 7';

/** Jaga document.title tetap sama dengan route aktif, buat history dan screen reader. */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}
