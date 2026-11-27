import './transition';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

/*
 * Holds the first render until the web font is ready (or `ms` has passed), so the loader's first frame is
 * already set in Inter Tight. The font is preloaded, so this is usually a few dozen milliseconds. Never rejects.
 */
function fontReady(ms: number): Promise<void> {
  if (!document.fonts) return Promise.resolve();
  const loaded = document.fonts.load('500 18px "Inter Tight"').then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loaded, new Promise<void>((resolve) => window.setTimeout(resolve, ms))]);
}

void fontReady(800).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
