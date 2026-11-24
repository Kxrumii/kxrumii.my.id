import { transitionIndex } from '../transition';

/** Huy-style rail: wordmark (vertical on desktop) that also links back to the PAW Portal. */
export function ShellRail() {
  return (
    <div className="shell-rail" data-shell="" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)}>
      <a
        className="wordmark"
        href="/tugas/"
        data-transition-link="document"
        data-transition-page="portal"
        data-transition-canvas="#0b0b0b"
        aria-label="Kxrumii — kembali ke Portal PAW"
      >
        KXRUMII<span aria-hidden="true">©</span>
      </a>
      <p className="rail-meta" aria-hidden="true">
        PAW · 07 · React
      </p>
    </div>
  );
}
