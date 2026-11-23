import { bridge } from './transition';
import './style.css';

// Contoh tipe dasar, interface, union type, array, dan generic untuk fondasi Tugas 6.
type TaskStatus = 'belum-selesai' | 'selesai';

interface Task {
  id: number;
  title: string;
  status: TaskStatus;
}

type TaskList = Task[];

function firstItem<T>(items: T[]): T | undefined {
  return items[0];
}

const appName: string = import.meta.env.VITE_APP_NAME || 'College Task Manager';
const appVersion: string = import.meta.env.VITE_APP_VERSION || '1.0.0';
const isFoundationReady: boolean = true;
const sampleTasks: TaskList = [
  { id: 1, title: 'Struktur awal aplikasi', status: 'selesai' },
  { id: 2, title: 'Fitur CRUD tugas kuliah', status: 'belum-selesai' },
];
const firstTask = firstItem<Task>(sampleTasks);
const firstTaskTitle: string = firstTask?.title ?? 'Belum ada tugas';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Elemen #app tidak ditemukan.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar" data-transition-exit data-transition-enter style="--i:0">
      <a class="brand" href="/tugas/" data-transition-link="document" data-transition-page="portal" data-transition-canvas="#0b0b0b">kxrumii<span>.my.id</span></a>
      <span class="eyebrow">PAW / PERTEMUAN 06</span>
    </header>

    <section class="hero" aria-labelledby="page-title" data-transition-exit data-transition-enter style="--i:1">
      <p class="eyebrow">VANILLA TYPESCRIPT + VITE</p>
      <h1 id="page-title">${appName}</h1>
      <p class="intro">
        Fondasi aplikasi pengelola tugas kuliah. Fitur tambah, edit, hapus,
        dan pengelolaan status akan dikembangkan pada tahap implementasi Tugas 6.
      </p>
      <div class="meta-row">
        <span>Version ${appVersion}</span>
        <span class="status"><i></i>${isFoundationReady ? 'Foundation ready' : 'In progress'}</span>
      </div>
    </section>

    <section class="preview" aria-labelledby="preview-title" data-transition-exit data-transition-enter style="--i:2">
      <div class="section-heading">
        <div>
          <p class="eyebrow">DEVELOPMENT PREVIEW</p>
          <h2 id="preview-title">Rencana pengerjaan</h2>
        </div>
        <span class="count">${sampleTasks.length} items · ${firstTaskTitle}</span>
      </div>
      <ul class="task-list">
        ${sampleTasks.map((task) => `
          <li class="task-item">
            <span class="task-number">${String(task.id).padStart(2, '0')}</span>
            <span class="task-title">${task.title}</span>
            <span class="task-status ${task.status}">${task.status === 'selesai' ? 'Selesai' : 'Belum selesai'}</span>
          </li>
        `).join('')}
      </ul>
    </section>

    <footer class="footer" data-transition-exit data-transition-enter style="--i:3">TypeScript workspace · ${new Date().getFullYear()}</footer>
  </main>
`;

// The shell is now in the DOM: allow the incoming route transition to enter.
bridge.markPageReady();
