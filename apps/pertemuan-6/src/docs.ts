import './style.css';
import { requireElement } from './render.ts';

// Halaman dokumentasi memakai navigasi native dan tidak memasang Shared Transition Bridge.
const appName: string = import.meta.env.VITE_APP_NAME || 'College Task Manager';
const appVersion: string = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Nilai env hanya ditulis lewat textContent.
requireElement(document, '#env-app-name', HTMLElement).textContent = appName;
requireElement(document, '#env-app-version', HTMLElement).textContent = appVersion;
requireElement(document, '#current-year', HTMLElement).textContent = String(new Date().getFullYear());
