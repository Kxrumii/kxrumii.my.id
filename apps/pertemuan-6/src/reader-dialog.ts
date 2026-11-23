import { resolveBoxVisual } from './archetypes.ts';
import { requireElement } from './render.ts';
import { deadlineLabel, deadlineState, formatDeadline } from './tasks.ts';
import { STATUS_LABELS, type Task } from './types.ts';

export type ReaderFocusTarget = () => HTMLElement | null;

export interface ReaderDialogHandlers {
  onToggle(id: number): void;
  onEdit(task: Task, returnFocus: () => HTMLElement | null): void;
  onDelete(task: Task, returnFocus: () => HTMLElement | null): void;
}

export interface ReaderDialog {
  open(
    taskId: number,
    visibleTasks: readonly Task[],
    allTasks: readonly Task[],
    returnFocus: ReaderFocusTarget,
    today?: Date,
  ): void;
  refresh(visibleTasks: readonly Task[], allTasks: readonly Task[], today?: Date): void;
  close(restoreFocus?: boolean): void;
  isOpen(): boolean;
  currentTaskId(): number | null;
}

/**
 * Dialog detail tugas ala editorial reader (`af-reader`):
 * menampilkan informasi penuh, kontrol status, Edit, Hapus, dan navigasi sebelumnya/berikutnya.
 * Semua teks pengguna ditulis lewat `textContent`.
 */
export function initReaderDialog(root: ParentNode, handlers: ReaderDialogHandlers): ReaderDialog {
  const dialog = requireElement(root, '#reader-dialog', HTMLDialogElement);
  const indexEl = requireElement(root, '#reader-index', HTMLElement);
  const closeBtn = requireElement(root, '#reader-close', HTMLButtonElement);
  const titleEl = requireElement(root, '#reader-title', HTMLElement);
  const courseEl = requireElement(root, '#reader-course', HTMLElement);
  const deadlineEl = requireElement(root, '#reader-deadline', HTMLElement);
  const urgencyEl = requireElement(root, '#reader-urgency', HTMLElement);
  const statusEl = requireElement(root, '#reader-status', HTMLElement);
  const toggleBtn = requireElement(root, '#reader-toggle', HTMLButtonElement);
  const editBtn = requireElement(root, '#reader-edit', HTMLButtonElement);
  const deleteBtn = requireElement(root, '#reader-delete', HTMLButtonElement);
  const prevBtn = requireElement(root, '#reader-prev', HTMLButtonElement);
  const nextBtn = requireElement(root, '#reader-next', HTMLButtonElement);

  let openId: number | null = null;
  let activeVisible: readonly Task[] = [];
  let activeAll: readonly Task[] = [];
  let returnFocus: ReaderFocusTarget = () => null;
  let suppressNextRestore = false;

  function populate(task: Task, visible: readonly Task[], today: Date): void {
    const urgency = deadlineState(task.deadline, task.status, today);
    const visual = resolveBoxVisual(task, urgency);
    const visibleIdx = visible.findIndex((item) => item.id === task.id);
    const total = visible.length;

    dialog.dataset.archetype = visual.archetype;
    dialog.dataset.deadlineState = urgency;
    dialog.dataset.done = String(task.status === 'selesai');

    if (visibleIdx >= 0) {
      indexEl.textContent = `TUGAS ${String(visibleIdx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    } else {
      indexEl.textContent = 'TUGAS · TERFILTER';
    }

    titleEl.textContent = task.title;
    courseEl.textContent = task.course === '' ? 'Tanpa mata kuliah' : task.course;
    deadlineEl.textContent = formatDeadline(task.deadline);

    const note = deadlineLabel(urgency);
    urgencyEl.textContent = note;
    urgencyEl.hidden = note === '';

    statusEl.textContent = STATUS_LABELS[task.status];
    statusEl.className = `reader-status ${task.status}`;

    const isDone = task.status === 'selesai';
    toggleBtn.textContent = isDone ? 'Tandai belum selesai' : 'Tandai selesai';
    toggleBtn.setAttribute('aria-pressed', String(isDone));

    prevBtn.disabled = visibleIdx <= 0;
    nextBtn.disabled = visibleIdx === -1 || visibleIdx >= total - 1;
  }

  function currentTask(): Task | undefined {
    if (openId === null) return undefined;
    return activeAll.find((item) => item.id === openId);
  }

  toggleBtn.addEventListener('click', () => {
    if (openId !== null) handlers.onToggle(openId);
  });

  editBtn.addEventListener('click', () => {
    const task = currentTask();
    if (task) handlers.onEdit(task, () => editBtn);
  });

  deleteBtn.addEventListener('click', () => {
    const task = currentTask();
    if (task) handlers.onDelete(task, () => deleteBtn);
  });

  prevBtn.addEventListener('click', () => {
    if (openId === null) return;
    const idx = activeVisible.findIndex((item) => item.id === openId);
    const target = idx > 0 ? activeVisible[idx - 1] : undefined;
    if (!target) return;
    openId = target.id;
    populate(target, activeVisible, new Date());
    dialog.scrollTop = 0;
  });

  nextBtn.addEventListener('click', () => {
    if (openId === null) return;
    const idx = activeVisible.findIndex((item) => item.id === openId);
    const target = idx >= 0 && idx < activeVisible.length - 1 ? activeVisible[idx + 1] : undefined;
    if (!target) return;
    openId = target.id;
    populate(target, activeVisible, new Date());
    dialog.scrollTop = 0;
  });

  closeBtn.addEventListener('click', () => {
    if (dialog.open) dialog.close();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && dialog.open) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    const restore = !suppressNextRestore;
    suppressNextRestore = false;
    openId = null;
    if (restore) {
      returnFocus()?.focus();
    }
  });

  return {
    open(taskId, visibleTasks, allTasks, focus, today = new Date()): void {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task) return;
      openId = task.id;
      activeVisible = visibleTasks;
      activeAll = allTasks;
      returnFocus = focus;
      suppressNextRestore = false;
      populate(task, visibleTasks, today);
      if (!dialog.open) {
        dialog.showModal();
      }
      dialog.scrollTop = 0;
      closeBtn.focus();
    },
    refresh(visibleTasks, allTasks, today = new Date()): void {
      if (openId === null || !dialog.open) return;
      activeVisible = visibleTasks;
      activeAll = allTasks;
      const task = allTasks.find((item) => item.id === openId);
      if (!task) {
        suppressNextRestore = true;
        dialog.close();
        return;
      }
      populate(task, visibleTasks, today);
    },
    close(restoreFocus = true): void {
      if (!dialog.open) return;
      suppressNextRestore = !restoreFocus;
      dialog.close();
    },
    isOpen(): boolean {
      return dialog.open;
    },
    currentTaskId(): number | null {
      return openId;
    },
  };
}
