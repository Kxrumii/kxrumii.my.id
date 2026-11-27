import { useEffect } from 'react';

const SUFFIX = 'Kxrumii ✲ Portfolio — Pertemuan 7';

/** Keeps document.title in sync with the active route for history and screen readers. */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}
