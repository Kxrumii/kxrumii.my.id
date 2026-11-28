import { resolveBoxVisual } from './archetypes.ts';
import { FILTER_LABELS, TASK_FILTERS, filterCounts, isTaskFilter, type TaskFilter } from './filters.ts';
import { countByStatus, deadlineLabel, deadlineState, formatDeadline } from './tasks.ts';
import { STATUS_LABELS, type DeadlineState, type Task, type TaskList } from './types.ts';

/**
 * Semua nilai dari pengguna ditulis lewat `textContent`; modul ini nggak pakai
 * API yang mem-parse string jadi HTML.
 */

/** Ambil elemen wajib dan pastikan tipenya; lempar error jelas kalau nggak cocok. */
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
  ];
  if (task.category) parts.push(`kategori ${task.category}`);
  parts.push(deadline === '—' ? 'tanpa tenggat' : `tenggat ${deadline}`);
  if (urgencyText !== '') parts.push(urgencyText);
  parts.push(`status ${STATUS_LABELS[task.status]}`);
  return parts.join(', ');
}

export interface OrbitPair {
  id: number;
  box: HTMLButtonElement;
  caption: HTMLElement;
}

export interface OrbitReconcileResult {
  entered: OrbitPair[];
  updated: OrbitPair[];
  restored: OrbitPair[];
  exiting: OrbitPair[];
}

function createCaptionElement(): HTMLSpanElement {
  const caption = document.createElement('span');
  caption.className = 'box-caption';
  caption.setAttribute('aria-hidden', 'true');
  return caption;
}

/** Update isi & atribut kotak tugas dan caption in-place, tanpa bikin node baru. */
export function updateTaskBox(
  box: HTMLButtonElement,
  caption: HTMLElement,
  task: Task,
  position: number,
  today: Date = new Date(),
): void {
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

  caption.dataset.captionFor = String(task.id);
  caption.dataset.done = String(isDone);
  caption.dataset.deadlineState = urgency;
  const shortTitle = task.title.length > 26 ? `${task.title.slice(0, 24).trimEnd()}…` : task.title;
  const statusTag = isDone ? '✓' : urgencyNote !== '' ? urgencyNote : 'Aktif';
  caption.textContent = `${num} · ${shortTitle} · ${statusTag}`;
}

/** Bikin satu kotak print orbital dari `<template>`; `position` itu nomor urut tampilan (mulai 1). */
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
  const caption = createCaptionElement();
  updateTaskBox(box, caption, task, position, today);
  return { box, caption };
}

/** Tandai kotak & caption orbital sebagai keluar (inert, nggak interaktif, transform luar tetap). */
export function markOrbitNodeExiting(box: HTMLButtonElement, caption: HTMLElement | null): void {
  box.dataset.exiting = 'true';
  box.setAttribute('aria-hidden', 'true');
  box.setAttribute('inert', '');
  box.disabled = true;
  box.tabIndex = -1;
  if (caption) {
    caption.dataset.exiting = 'true';
    caption.setAttribute('inert', '');
  }
}

/** Balikin kotak & caption orbital yang keluar jadi aktif lagi. */
export function restoreOrbitNodeActive(box: HTMLButtonElement, caption: HTMLElement | null): void {
  delete box.dataset.exiting;
  box.removeAttribute('aria-hidden');
  box.removeAttribute('inert');
  box.disabled = false;
  box.tabIndex = 0;
  if (caption) {
    delete caption.dataset.exiting;
    caption.removeAttribute('inert');
  }
}

/**
 * Rekonsiliasi DOM panggung orbital berdasar `task.id` yang stabil: node yang bertahan
 * di-update di tempat, node baru disisipkan, node lama ditandai keluar (atau langsung
 * dihapus kalau `immediate = true`).
 */
export function reconcileOrbitalStage(
  stage: HTMLElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  startPosition = 1,
  today: Date = new Date(),
  immediate = false,
): OrbitReconcileResult {
  const existingBoxes = new Map<number, HTMLButtonElement>();
  for (const el of Array.from(stage.querySelectorAll<HTMLButtonElement>('.task-box[data-task-id]'))) {
    const id = Number(el.dataset.taskId);
    if (!Number.isSafeInteger(id) || id <= 0 || existingBoxes.has(id)) {
      el.remove();
      continue;
    }
    existingBoxes.set(id, el);
  }

  const existingCaptions = new Map<number, HTMLElement>();
  for (const el of Array.from(stage.querySelectorAll<HTMLElement>('.box-caption[data-caption-for]'))) {
    const id = Number(el.dataset.captionFor);
    if (!Number.isSafeInteger(id) || id <= 0 || existingCaptions.has(id)) {
      el.remove();
      continue;
    }
    existingCaptions.set(id, el);
  }

  const entered: OrbitPair[] = [];
  const updated: OrbitPair[] = [];
  const restored: OrbitPair[] = [];
  const exiting: OrbitPair[] = [];
  const nextIds = new Set<number>();

  tasks.forEach((task, index) => {
    nextIds.add(task.id);
    const existingBox = existingBoxes.get(task.id);
    if (existingBox) {
      let caption = existingCaptions.get(task.id) ?? null;
      const wasExiting = existingBox.dataset.exiting === 'true';
      if (!caption) {
        caption = createCaptionElement();
        stage.append(caption);
      }
      if (wasExiting) {
        restoreOrbitNodeActive(existingBox, caption);
      }
      updateTaskBox(existingBox, caption, task, startPosition + index, today);
      const pair: OrbitPair = { id: task.id, box: existingBox, caption };
      if (wasExiting) {
        restored.push(pair);
      } else {
        updated.push(pair);
      }
    } else {
      const { box, caption } = createTaskBox(template, task, startPosition + index, today);
      stage.append(box, caption);
      entered.push({ id: task.id, box, caption });
    }
  });

  for (const [id, box] of existingBoxes.entries()) {
    if (nextIds.has(id)) continue;
    const caption = existingCaptions.get(id) ?? null;
    if (immediate) {
      box.remove();
      caption?.remove();
    } else if (box.dataset.exiting !== 'true') {
      markOrbitNodeExiting(box, caption);
      if (caption) {
        exiting.push({ id, box, caption });
      } else {
        const placeholder = createCaptionElement();
        placeholder.dataset.captionFor = String(id);
        placeholder.dataset.exiting = 'true';
        exiting.push({ id, box, caption: placeholder });
      }
    }
  }

  return { entered, updated, restored, exiting };
}

export function renderOrbitalStage(
  stage: HTMLElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  startPosition = 1,
  today: Date = new Date(),
): void {
  reconcileOrbitalStage(stage, template, tasks, startPosition, today, true);
}

export interface ListRowEntry {
  id: number;
  row: HTMLLIElement;
}

export interface ListReconcileResult {
  entered: ListRowEntry[];
  updated: ListRowEntry[];
  removedCount: number;
}

/** Update isi & atribut baris daftar in-place, tanpa ganti node `<li>`. */
export function updateListRow(
  row: HTMLLIElement,
  task: Task,
  position: number,
  today: Date = new Date(),
): void {
  if (row.dataset.exiting === 'true') {
    delete row.dataset.exiting;
    row.removeAttribute('aria-hidden');
    row.removeAttribute('inert');
    for (const focusable of Array.from(row.querySelectorAll<HTMLElement>('button, input'))) {
      focusable.tabIndex = 0;
    }
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

  const categoryEl = slot(row, 'category');
  const categoryText = task.category ?? '';
  categoryEl.textContent = categoryText;
  categoryEl.hidden = categoryText === '';

  const descriptionEl = slot(row, 'description');
  const descriptionText = task.description ?? '';
  descriptionEl.textContent = descriptionText;
  descriptionEl.hidden = descriptionText === '';

  slot(row, 'deadline').textContent = formatDeadline(task.deadline);
  slot(row, 'deadline-note').textContent = deadlineLabel(urgency);

  const status = slot(row, 'status');
  status.textContent = STATUS_LABELS[task.status];
  status.className = `list-status ${task.status}`;

  const toggle = requireElement(row, '[data-slot="toggle"]', HTMLInputElement);
  toggle.checked = isDone;
  toggle.setAttribute(
    'aria-label',
    isDone ? `Status selesai: ${task.title}. Tandai belum selesai` : `Status belum selesai: ${task.title}. Tandai selesai`,
  );
  slot(row, 'edit').setAttribute('aria-label', `Edit tugas: ${task.title}`);
  slot(row, 'delete').setAttribute('aria-label', `Hapus tugas: ${task.title}`);
}

/** Bikin satu baris daftar aksesibel buat koleksi besar (>12 tugas) atau mode Daftar. */
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
  updateListRow(row, task, position, today);
  return row;
}

/**
 * Rekonsiliasi daftar aksesibel berdasar `task.id` (keyed): node yang bertahan di-update
 * di tempat (fokus kontrol kayak checkbox terjaga) dan cuma disisipkan ulang kalau posisi DOM berubah.
 */
export function reconcileAccessibleList(
  list: HTMLOListElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  today: Date = new Date(),
): ListReconcileResult {
  const existing = new Map<number, HTMLLIElement>();
  let removedCount = 0;

  for (const el of Array.from(list.children)) {
    if (!(el instanceof HTMLLIElement)) {
      el.remove();
      removedCount += 1;
      continue;
    }
    const id = Number(el.dataset.taskId);
    if (!Number.isSafeInteger(id) || id <= 0 || existing.has(id)) {
      el.remove();
      removedCount += 1;
      continue;
    }
    existing.set(id, el);
  }

  const entered: ListRowEntry[] = [];
  const updated: ListRowEntry[] = [];
  const ordered: HTMLLIElement[] = [];
  const nextIds = new Set<number>();

  tasks.forEach((task, index) => {
    nextIds.add(task.id);
    const existingRow = existing.get(task.id);
    if (existingRow) {
      updateListRow(existingRow, task, index + 1, today);
      updated.push({ id: task.id, row: existingRow });
      ordered.push(existingRow);
    } else {
      const row = createListRow(template, task, index + 1, today);
      entered.push({ id: task.id, row });
      ordered.push(row);
    }
  });

  for (const [id, row] of existing.entries()) {
    if (!nextIds.has(id)) {
      row.remove();
      removedCount += 1;
    }
  }

  for (let i = 0; i < ordered.length; i += 1) {
    const desired = ordered[i]!;
    const current = list.children[i] ?? null;
    if (current !== desired) {
      list.insertBefore(desired, current);
    }
  }

  return { entered, updated, removedCount };
}

export function renderAccessibleList(
  list: HTMLOListElement,
  template: HTMLTemplateElement,
  tasks: TaskList,
  today: Date = new Date(),
): void {
  reconcileAccessibleList(list, template, tasks, today);
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

/** Update tombol filter: jumlah (dari seluruh daftar), `aria-pressed`, dan nama yang terbaca. */
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
