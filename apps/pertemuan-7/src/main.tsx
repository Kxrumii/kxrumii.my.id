import './transition';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

/*
 * Tahan render pertama sampai web font siap (atau `ms` lewat), biar frame pertama loader udah pakai Inter Tight.
 * Font-nya di-preload, jadi biasanya cuma beberapa puluh milidetik. Nggak pernah reject.
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
