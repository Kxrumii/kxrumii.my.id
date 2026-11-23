import { resolveBoxVisual } from './archetypes.ts';
import { FILTER_LABELS, TASK_FILTERS, filterCounts, isTaskFilter, type TaskFilter } from './filters.ts';
import { countByStatus, deadlineLabel, deadlineState, formatDeadline } from './tasks.ts';
import { STATUS_LABELS, type DeadlineState, type Task, type TaskList } from './types.ts';

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

function boxAriaLabel(task: Task, urgency: DeadlineState): string {
  const course = task.course === '' ? 'Tanpa mata kuliah' : task.course;
  const deadline = formatDeadline(task.deadline);
  const urgencyText = deadlineLabel(urgency);
  const parts = [
    task.title,
    `mata kuliah ${course}`,
    deadline === '—' ? 'tanpa tenggat' : `tenggat ${deadline}`,
  ];
  if (urgencyText !== '') parts.push(urgencyText);
  parts.push(`status ${STATUS_LABELS[task.status]}`);
  return parts.join(', ');
}

/** Membuat satu kotak print orbital dari `<template>`; `position` adalah nomor urut tampilan (mulai 1). */
export function createTaskBox(
  template: HTMLTemplateElement,
  task: Task,
  position: number,
  today: Date = new Date(),
): { box: HTMLButtonElement; caption: HTMLSpanElement } {
  const box = template.content.firstElementChild?.cloneNode(true);
  if (!(box instanceof HTMLButtonElement)) {
    throw new Error('Template kotak tugas harus berisi satu elemen <button>.');
  }
  const urgency = deadlineState(task.deadline, task.status, today);
  const visual = resolveBoxVisual(task, urgency);
  const isDone = task.status === 'selesai';
  const num = String(position).padStart(2, '0');
  const course = task.course === '' ? 'TANPA MATA KULIAH' : task.course.toUpperCase();

  box.dataset.taskId = String(task.id);
  box.dataset.archetype = visual.archetype;
  box.dataset.surface = visual.surface;
  box.dataset.tone = visual.tone;
  box.dataset.texture = visual.texture;
  box.dataset.proportion = visual.proportion;
  box.dataset.deadlineState = urgency;
  box.dataset.done = String(isDone);
  box.setAttribute('aria-haspopup', 'dialog');
  box.setAttribute('aria-label', boxAriaLabel(task, urgency));

  slot(box, 'head').textContent = `${num} / ${course}`;

  const linesEl = slot(box, 'lines');
  const lineSpans = visual.lines.map((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
  });
  linesEl.replaceChildren(...lineSpans);

  slot(box, 'deadline').textContent = formatDeadline(task.deadline);
  const urgencySlot = slot(box, 'urgency');
  const urgencyNote = deadlineLabel(urgency);
  urgencySlot.textContent = isDone ? 'SELESAI ✓' : urgencyNote;

  const caption = document.createElement('span');
  caption.className = 'box-caption';
  caption.setAttribute('aria-hidden', 'true');
  caption.dataset.done = String(isDone);
  caption.dataset.deadlineState = urgency;
  const shortTitle = task.title.length > 26 ? `${task.title.slice(0, 24).trimEnd()}…` : task.title;
  const statusTag = isDone ? '✓' : urgencyNote !== '' ? urgencyNote : 'Aktif';
  caption.textContent = `${num} · ${shortTitle} · ${statusTag}`;

  return { box, caption };
}

/** Merender kotak-kotak tugas beserta keterangan melayang ke dalam panggung orbital. */
export function renderOrbitalStage(
  stage: HTMLElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  startPosition = 1,
  today: Date = new Date(),
): void {
  const boxes: HTMLButtonElement[] = [];
  const captions: HTMLSpanElement[] = [];
  tasks.forEach((task, index) => {
    const { box, caption } = createTaskBox(template, task, startPosition + index, today);
    boxes.push(box);
    captions.push(caption);
  });
  stage.replaceChildren(...boxes, ...captions);
}

/** Membuat satu baris daftar aksesibel untuk tampilan koleksi besar (>12 tugas) atau mode Daftar. */
export function createListRow(
  template: HTMLTemplateElement,
  task: Task,
  position: number,
  today: Date = new Date(),
): HTMLLIElement {
  const row = template.content.firstElementChild?.cloneNode(true);
  if (!(row instanceof HTMLLIElement)) {
    throw new Error('Template baris daftar harus berisi satu elemen <li>.');
  }
  const urgency = deadlineState(task.deadline, task.status, today);
  const isDone = task.status === 'selesai';

  row.dataset.taskId = String(task.id);
  row.dataset.deadlineState = urgency;
  row.classList.toggle('is-done', isDone);

  slot(row, 'number').textContent = String(position).padStart(2, '0');
  slot(row, 'title').textContent = task.title;
  slot(row, 'open').setAttribute('aria-label', `Buka detail tugas: ${task.title}`);
  slot(row, 'course').textContent = task.course === '' ? 'Tanpa mata kuliah' : task.course;
  slot(row, 'deadline').textContent = formatDeadline(task.deadline);
  slot(row, 'deadline-note').textContent = deadlineLabel(urgency);

  const status = slot(row, 'status');
  status.textContent = STATUS_LABELS[task.status];
  status.className = `list-status ${task.status}`;

  slot(row, 'status-sr').textContent = STATUS_LABELS[task.status];

  const toggle = requireElement(row, '[data-slot="toggle"]', HTMLInputElement);
  toggle.checked = isDone;
  toggle.setAttribute('aria-label', `Selesai: ${task.title}`);
  slot(row, 'edit').setAttribute('aria-label', `Edit tugas: ${task.title}`);
  slot(row, 'delete').setAttribute('aria-label', `Hapus tugas: ${task.title}`);

  return row;
}

export function renderAccessibleList(
  list: HTMLOListElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  today: Date = new Date(),
): void {
  list.replaceChildren(
    ...tasks.map((task, index) => createListRow(template, task, index + 1, today)),
  );
}

/** Indeks rentang arsip di footer (mis. `01—08 · 3 SELESAI` atau `00 · 0 TUGAS`). */
export function renderRangeIndex(
  target: HTMLElement,
  start: number,
  end: number,
  totalVisible: number,
  allTasks: TaskList,
): void {
  const done = countByStatus(allTasks).selesai;
  if (allTasks.length === 0) {
    target.textContent = '00 · 0 TUGAS';
    return;
  }
  if (totalVisible === 0) {
    target.textContent = `00 / ${String(allTasks.length).padStart(2, '0')} · ${done} SELESAI`;
    return;
  }
  const a = String(start).padStart(2, '0');
  const b = String(end).padStart(2, '0');
  const range = start === end ? a : `${a}—${b}`;
  const totalNote = totalVisible > end - start + 1 ? ` / ${String(totalVisible).padStart(2, '0')}` : '';
  target.textContent = `${range}${totalNote} · ${done} SELESAI`;
}

export function renderSummary(target: HTMLElement, tasks: TaskList): void {
  const done = countByStatus(tasks).selesai;
  target.textContent = `${tasks.length} tugas · ${done} selesai`;
}

/** Memperbarui tombol filter: jumlah (dari seluruh daftar), `aria-pressed`, dan nama yang terbaca. */
export function renderFilterBar(bar: HTMLElement, tasks: TaskList, active: TaskFilter): void {
  const counts = filterCounts(tasks);
  for (const button of bar.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
    const filter = button.dataset.filter;
    if (!isTaskFilter(filter)) continue;
    button.setAttribute('aria-pressed', String(filter === active));
    const count = requireElement(button, '[data-count]', HTMLElement);
    count.textContent = String(counts[filter]).padStart(2, '0');
    button.setAttribute('aria-label', `${FILTER_LABELS[filter]}: ${counts[filter]} tugas`);
  }
}

/** Tombol filter untuk `filter`; dipakai sebagai target fokus. */
export function filterButton(bar: ParentNode, filter: TaskFilter): HTMLButtonElement {
  if (!TASK_FILTERS.includes(filter)) throw new Error(`Filter tidak dikenal: ${filter}`);
  return requireElement(bar, `[data-filter="${filter}"]`, HTMLButtonElement);
}
