import { bridge } from './transition';
import './style.css';
import { renderLedger, renderSummary, requireElement } from './render.ts';
import { initDeleteDialog } from './delete-dialog.ts';
import { initTaskDialog } from './task-dialog.ts';
import { describeLoad, describeSaveFailure, getBrowserStorage, loadTasks, saveTasks } from './storage.ts';
import { createTask, removeTask, survivorId, toggleStatus, updateTask } from './tasks.ts';
import type { Task } from './types.ts';

const appName: string = import.meta.env.VITE_APP_NAME || 'College Task Manager';
const appVersion: string = import.meta.env.VITE_APP_VERSION || '1.0.0';

// State dipulihkan dari localStorage (divalidasi) sebelum render pertama; bila gagal, mulai kosong di memori.
let tasks: Task[] = [];

try {
  requireElement(document, '#page-title', HTMLHeadingElement).textContent = appName;
  requireElement(document, '#app-version', HTMLElement).textContent = appVersion;
  requireElement(document, '#current-year', HTMLElement).textContent = String(new Date().getFullYear());

  const list = requireElement(document, '#task-list', HTMLOListElement);
  const emptyState = requireElement(document, '#empty-state', HTMLElement);
  const template = requireElement(document, '#task-row-template', HTMLTemplateElement);
  const summary = requireElement(document, '#task-summary', HTMLElement);
  const emptyAdd = requireElement(document, '#add-task-button', HTMLButtonElement);
  const headerAdd = requireElement(document, '#add-task-header', HTMLButtonElement);
  const liveStatus = requireElement(document, '#live-status', HTMLElement);
  const storageNotice = requireElement(document, '#storage-notice', HTMLElement);

  const storage = getBrowserStorage();
  const loaded = loadTasks(storage);
  tasks = loaded.tasks;
  // Satu notifikasi terlihat: kegagalan simpan menggantikan pesan pemuatan; simpan yang berhasil menghapus keduanya.
  let notice: string | null = describeLoad(loaded);

  function showNotice(message: string | null): void {
    notice = message;
    storageNotice.textContent = message ?? '';
    storageNotice.hidden = message === null;
  }

  // Dipanggil setelah state di memori diperbarui oleh aksi pengguna; kegagalan tidak membatalkan aksi.
  function persist(): void {
    const result = saveTasks(storage, tasks);
    showNotice(result.ok ? null : describeSaveFailure(result.reason));
  }

  function announce(message: string): void {
    liveStatus.textContent = message;
  }

  // Umpan balik singkat pada ringkasan; dilewati oleh CSS bila reduced motion.
  function pulseSummary(): void {
    summary.classList.remove('is-pulsing');
    void summary.offsetWidth;
    summary.classList.add('is-pulsing');
  }

  function render(changedId: number | null = null): void {
    renderLedger(list, emptyState, template, tasks, changedId);
    renderSummary(summary, tasks);
    headerAdd.hidden = tasks.length === 0;
  }

  const dialog = initTaskDialog(document, {
    onCreate(draft) {
      tasks = createTask(tasks, draft);
      persist();
      render();
    },
    onEdit(id, draft) {
      const before = tasks.find((task) => task.id === id);
      tasks = updateTask(tasks, id, draft);
      const unchanged =
        before !== undefined &&
        before.title === draft.title &&
        before.course === draft.course &&
        before.deadline === draft.deadline;
      if (!unchanged) persist();
      render();
    },
  });

  const rowControl = (id: number, action: 'toggle' | 'edit' | 'delete') =>
    list.querySelector<HTMLElement>(`[data-task-id="${id}"] [data-action="${action}"]`);

  const deleteDialog = initDeleteDialog(document, (id) => {
    if (!tasks.some((task) => task.id === id)) return; // id usang: abaikan
    tasks = removeTask(tasks, id);
    persist();
    render();
    pulseSummary();
    announce('Tugas dihapus.');
  });

  // Tombol tambah yang sedang terlihat; dievaluasi saat dialog menutup.
  const visibleAddButton = () => (tasks.length === 0 ? emptyAdd : headerAdd);
  emptyAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));
  headerAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));

  // Delegasi event: baris dirender ulang penuh, jadi listener dipasang sekali pada daftar.
  const taskFrom = (element: Element | null): Task | undefined => {
    const id = Number(element?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId);
    return tasks.find((item) => item.id === id);
  };

  list.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const edit = target?.closest('[data-action="edit"]') ?? null;
    const remove = target?.closest('[data-action="delete"]') ?? null;
    const task = taskFrom(edit ?? remove);
    if (!task) return;
    if (edit) {
      dialog.openEdit(task, () => rowControl(task.id, 'edit') ?? visibleAddButton());
    } else {
      const next = survivorId(tasks, task.id);
      deleteDialog.open(task, (deleted) => {
        if (!deleted) return rowControl(task.id, 'delete') ?? visibleAddButton();
        return (next === null ? null : rowControl(next, 'delete')) ?? visibleAddButton();
      });
    }
  });

  list.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.matches('[data-action="toggle"]')) return;
    const task = taskFrom(target);
    if (!task) return;
    tasks = toggleStatus(tasks, task.id);
    persist();
    render(task.id);
    pulseSummary();
    rowControl(task.id, 'toggle')?.focus();
    announce(task.status === 'selesai' ? 'Ditandai belum selesai.' : 'Ditandai selesai.');
  });

  showNotice(notice);
  render();
} finally {
  // The shell is in the DOM and initialisation has run: allow the incoming route transition to enter.
  // Called in `finally` so a failed init can never leave the page stuck in the transition pre-state.
  bridge.markPageReady();
}
