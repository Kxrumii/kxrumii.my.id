/*
 * Sound gate state. The gate is shown once per browser session; the
 * `data-gate` attribute is set on <html> before React renders so the shell and
 * stage are hidden from the very first paint while the gate is open.
 */
const SESSION_KEY = 't9:gate';

export function gatePassed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'done';
  } catch {
    return false;
  }
}

export function markGatePassed(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, 'done');
  } catch {
    /* storage disabled: the gate shows again on the next load */
  }
}

export function initGate(root: HTMLElement = document.documentElement): void {
  if (gatePassed()) delete root.dataset.gate;
  else root.dataset.gate = 'open';
}
