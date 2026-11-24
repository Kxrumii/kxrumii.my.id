import { useEffect } from 'react';

const SUFFIX = 'Portfolio — Pertemuan 7';

/** Keeps document.title in sync with the active route for history and screen readers. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}
