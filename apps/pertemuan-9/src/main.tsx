import './transition';
import { initGate } from './shell/gate';
import { installSpringEasing } from './motion/spring';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

initGate();
installSpringEasing();

/*
 * Holds the first render until both web fonts are ready (or `ms` has passed). The fonts are preloaded, so this is
 * usually a few dozen milliseconds, and the first layout is then computed with the real fonts: Gecko otherwise paints
 * its first frames in an unadjusted system font (the size-adjusted fallbacks are still "unloaded" then) and reflows
 * once when the fonts attach, which moved the shell and the work info by up to tens of pixels on a cold load.
 * `font-display: swap` stays as the safety net when a font is slow. Never rejects.
 */
function fontsReady(ms: number): Promise<void> {
  if (!document.fonts) return Promise.resolve();
  const loaded = Promise.all([
    document.fonts.load('400 24px "Bricolage Grotesque"'),
    document.fonts.load('500 12px "Inter Tight"'),
  ]).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loaded, new Promise<void>((resolve) => window.setTimeout(resolve, ms))]);
}

void fontsReady(800).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
