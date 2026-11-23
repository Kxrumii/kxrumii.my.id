import { bridge } from './transition';
import './style.css';
import { renderLedger, renderSummary, requireElement } from './render.ts';
import type { Task } from './types.ts';

const appName: string = import.meta.env.VITE_APP_NAME || 'College Task Manager';
const appVersion: string = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Daftar dimulai kosong; persistensi ditambahkan pada milestone berikutnya.
const tasks: Task[] = [];

try {
  requireElement(document, '#page-title', HTMLHeadingElement).textContent = appName;
  requireElement(document, '#app-version', HTMLElement).textContent = appVersion;
  requireElement(document, '#current-year', HTMLElement).textContent = String(new Date().getFullYear());

  const list = requireElement(document, '#task-list', HTMLOListElement);
  const emptyState = requireElement(document, '#empty-state', HTMLElement);
  const template = requireElement(document, '#task-row-template', HTMLTemplateElement);
  const summary = requireElement(document, '#task-summary', HTMLElement);

  renderLedger(list, emptyState, template, tasks);
  renderSummary(summary, tasks);
} finally {
  // The shell is in the DOM and initialisation has run: allow the incoming route transition to enter.
  // Called in `finally` so a failed init can never leave the page stuck in the transition pre-state.
  bridge.markPageReady();
}
