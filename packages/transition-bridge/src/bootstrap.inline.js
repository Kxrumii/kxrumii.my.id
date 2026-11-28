/*
 * Di-inline di <head>, SEBELUM stylesheet dan bundle app.
 * Baca handshake dari halaman asal, lalu cat warna canvas tujuan dan pre-state
 * elemen sebelum first paint. Nggak ada overlay.
 */
(() => {
  const key = 'kxrumii:transition:v4';
  const normalize = (p) => (p === '/' ? '/' : `${p.replace(/\/+$/, '')}/`);
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key); // sekali pakai
    const p = JSON.parse(raw);
    if (!p || p.version !== 4 || p.expiresAt < Date.now()) return;
    if (normalize(location.pathname) !== normalize(p.toPath)) return;

    const root = document.documentElement;
    root.dataset.transitionState = 'entering';
    root.dataset.transitionFrom = p.fromPage || 'unknown';
    if (p.canvasColor) root.style.setProperty('--page-canvas', p.canvasColor);
    if (p.origin) {
      root.style.setProperty('--transition-origin-x', `${p.origin.x}px`);
      root.style.setProperty('--transition-origin-y', `${p.origin.y}px`);
    }
    // Fail-open: jangan sampai halaman nyangkut di pre-state kalau bundle gagal.
    window.__kxrumiiTransitionBootstrapTimer = window.setTimeout(() => {
      if (root.dataset.transitionState !== 'entering') return;
      delete root.dataset.transitionState;
      root.removeAttribute('data-transition-from');
    }, 1800);
  } catch {
    /* storage/DOM nggak tersedia: navigasi native tetap jalan */
  }
})();
