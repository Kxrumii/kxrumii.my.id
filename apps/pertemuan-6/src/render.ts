import { countByStatus, formatDeadline } from './tasks.ts';
import { STATUS_LABELS, type Task, type TaskList } from './types.ts';

/**
 * Semua nilai yang berasal dari pengguna ditulis lewat `textContent`.
 * Modul ini tidak memakai API yang mem-parse string menjadi HTML.
 */

/** Mengambil elemen wajib dan memastikan tipenya; melempar error yang jelas bila tidak cocok. */
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: { new (): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Elemen "${selector}" tidak ditemukan atau bertipe salah.`);
  }
  return element;
}

function slot(row: Element, name: string): HTMLElement {
  return requireElement(row, `[data-slot="${name}"]`, HTMLElement);
}

/** Membuat satu baris dari `<template>`; `position` adalah nomor urut tampilan (mulai 1). */
export function createTaskRow(template: HTMLTemplateElement, task: Task, position: number, changed = false): HTMLLIElement {
  const row = template.content.firstElementChild?.cloneNode(true);
  if (!(row instanceof HTMLLIElement)) {
    throw new Error('Template baris tugas harus berisi satu elemen <li>.');
  }
  row.dataset.taskId = String(task.id);
  if (changed) row.classList.add('is-changed');
  slot(row, 'number').textContent = String(position).padStart(2, '0');
  slot(row, 'title').textContent = task.title;
  slot(row, 'course').textContent = task.course === '' ? 'Tanpa mata kuliah' : task.course;
  slot(row, 'deadline').textContent = formatDeadline(task.deadline);
  const status = slot(row, 'status');
  status.textContent = STATUS_LABELS[task.status];
  status.classList.add(task.status);
  row.classList.toggle('is-done', task.status === 'selesai');
  const toggle = requireElement(row, '[data-slot="toggle"]', HTMLInputElement);
  toggle.checked = task.status === 'selesai';
  toggle.setAttribute('aria-label', `Selesai: ${task.title}`);
  slot(row, 'edit').setAttribute('aria-label', `Edit tugas: ${task.title}`);
  slot(row, 'delete').setAttribute('aria-label', `Hapus tugas: ${task.title}`);
  return row;
}

export function renderLedger(
  list: HTMLOListElement,
  emptyState: HTMLElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  changedId: number | null = null,
): void {
  list.replaceChildren(...tasks.map((task, index) => createTaskRow(template, task, index + 1, task.id === changedId)));
  list.hidden = tasks.length === 0;
  emptyState.hidden = tasks.length > 0;
}

export function renderSummary(target: HTMLElement, tasks: TaskList): void {
  const done = countByStatus(tasks).selesai;
  target.textContent = `${tasks.length} tugas · ${done} selesai`;
}
