import { transitionIndex } from '../transition';

export function AppHeader() {
  return (
    <header className="app-header" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)}>
      <a
        className="wordmark"
        href="/tugas/"
        data-transition-link="document"
        data-transition-page="portal"
        data-transition-canvas="#0b0b0b"
      >kxrumii<span>.my.id</span></a>
      <span className="eyebrow">REACT + VITE</span>
    </header>
  );
}
