import { installTask6Transition } from './transition.ts';
import './style.css';
import { initDocAccordions } from './accordion.ts';
import { bindBridgeCancellation, registerTransitionFlush } from './motion.ts';
import { requireElement } from './render.ts';
import { initThemeToggle } from './theme.ts';

const bridge = installTask6Transition('task-6-docs');

try {
  const appName: string = import.meta.env.VITE_APP_NAME || 'Task Manager';
  const appVersion: string = import.meta.env.VITE_APP_VERSION || '1.0.0';

  bindBridgeCancellation(document);
  const accordions = initDocAccordions(document);
  registerTransitionFlush(() => accordions.flush());

  initThemeToggle(requireElement(document, '#theme-toggle', HTMLButtonElement));

  // Nilai env hanya ditulis lewat textContent.
  requireElement(document, '#env-app-name', HTMLElement).textContent = appName;
  requireElement(document, '#env-app-version', HTMLElement).textContent = appVersion;
  requireElement(document, '#current-year', HTMLElement).textContent = String(new Date().getFullYear());
} finally {
  // Selalu beri sinyal siap agar dokumen dokumentasi tidak pernah tertahan di pre-state transisi.
  bridge.markPageReady();
}
