import { resolveBoxVisual } from './archetypes.ts';
import {
  EASE_EXIT,
  EASE_OUT,
  READER_CLOSE_FALLBACK_MS,
  animateElement,
  canAnimate,
  cancelMotionGroup,
  resolveReaderBoundaryFocus,
  type AnimationLike,
} from './motion.ts';
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
  pulseStatus(): void;
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
  const articleEl = requireElement(root, '.reader-article', HTMLElement);
  const indexEl = requireElement(root, '#reader-index', HTMLElement);
  const closeBtn = requireElement(root, '#reader-close', HTMLButtonElement);
  const titleEl = requireElement(root, '#reader-title', HTMLElement);
  const descriptionEl = requireElement(root, '#reader-description', HTMLElement);
  const courseEl = requireElement(root, '#reader-course', HTMLElement);
  const categoryRowEl = requireElement(root, '#reader-category-row', HTMLElement);
  const categoryEl = requireElement(root, '#reader-category', HTMLElement);
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
  let closing = false;
  let closeTimer = 0;
  let closeToken = 0;
  let activeCloseAnim: AnimationLike | null = null;

  function safeCancelAnimation(anim: AnimationLike | null | undefined): void {
    if (!anim) return;
    try {
      anim.cancel();
    } catch {
      /* animasi mungkin sudah selesai atau dibatalkan */
    }
  }

  function clearReaderAnimations(extra?: AnimationLike | null): void {
    const closeAnim = activeCloseAnim;
    activeCloseAnim = null;
    cancelMotionGroup('reader');
    safeCancelAnimation(closeAnim);
    if (extra && extra !== closeAnim) safeCancelAnimation(extra);
    if (typeof dialog.getAnimations === 'function') {
      for (const anim of dialog.getAnimations()) {
        safeCancelAnimation(anim);
      }
    }
  }

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
    const descriptionText = task.description ?? '';
    descriptionEl.textContent = descriptionText;
    descriptionEl.hidden = descriptionText === '';

    courseEl.textContent = task.course === '' ? 'Tanpa mata kuliah' : task.course;

    const categoryText = task.category ?? '';
    categoryEl.textContent = categoryText;
    categoryRowEl.hidden = categoryText === '';

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

  function requestClose(restoreFocus: boolean, immediate: boolean): void {
    if (!dialog.open) return;
    suppressNextRestore = !restoreFocus;
    if (immediate || closing || !canAnimate()) {
      window.clearTimeout(closeTimer);
      closing = false;
      closeToken += 1;
      dialog.close();
      clearReaderAnimations();
      return;
    }

    closing = true;
    const token = ++closeToken;
    let anim: AnimationLike | null = null;
    const finalize = (): void => {
      if (token !== closeToken || !closing) return;
      window.clearTimeout(closeTimer);
      closing = false;
      if (dialog.open) dialog.close();
      clearReaderAnimations(anim);
    };

    anim = animateElement(
      'reader',
      dialog,
      [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, 8px, 0)', opacity: 0 },
      ],
      { duration: 180, easing: EASE_EXIT, fill: 'forwards' },
    );
    activeCloseAnim = anim;
    if (!anim) {
      finalize();
      return;
    }
    closeTimer = window.setTimeout(finalize, READER_CLOSE_FALLBACK_MS);
    void Promise.resolve(anim.finished).then(finalize, () => {});
  }

  function navigateStep(direction: 'prev' | 'next'): void {
    if (openId === null || closing) return;
    const idx = activeVisible.findIndex((item) => item.id === openId);
    const target =
      direction === 'prev'
        ? idx > 0
          ? activeVisible[idx - 1]
          : undefined
        : idx >= 0 && idx < activeVisible.length - 1
          ? activeVisible[idx + 1]
          : undefined;
    if (!target) return;

    const triggerBtn = direction === 'prev' ? prevBtn : nextBtn;
    const wasFocused = document.activeElement === triggerBtn;

    openId = target.id;
    populate(target, activeVisible, new Date());
    dialog.scrollTop = 0;

    if (wasFocused) {
      const nextFocus = resolveReaderBoundaryFocus(direction, prevBtn.disabled, nextBtn.disabled);
      if (nextFocus === 'prev') prevBtn.focus();
      else if (nextFocus === 'next') nextBtn.focus();
      else if (nextFocus === 'close') closeBtn.focus();
    }

    const dx = direction === 'next' ? 16 : -16;
    animateElement(
      'reader',
      articleEl,
      [
        { transform: `translate3d(${dx}px, 0, 0)`, opacity: 0.25 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
      ],
      { duration: 180, easing: EASE_OUT, fill: 'backwards' },
    );
  }

  toggleBtn.addEventListener('click', () => {
    if (openId !== null && !closing) handlers.onToggle(openId);
  });

  editBtn.addEventListener('click', () => {
    if (closing) return;
    const task = currentTask();
    if (task) handlers.onEdit(task, () => editBtn);
  });

  deleteBtn.addEventListener('click', () => {
    if (closing) return;
    const task = currentTask();
    if (task) handlers.onDelete(task, () => deleteBtn);
  });

  prevBtn.addEventListener('click', () => navigateStep('prev'));
  nextBtn.addEventListener('click', () => navigateStep('next'));

  closeBtn.addEventListener('click', () => requestClose(true, false));

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && dialog.open) {
      requestClose(true, false);
    }
  });

  dialog.addEventListener('cancel', (event) => {
    if (!canAnimate()) return;
    event.preventDefault();
    requestClose(true, closing);
  });

  dialog.addEventListener('close', () => {
    window.clearTimeout(closeTimer);
    closing = false;
    closeToken += 1;
    clearReaderAnimations();
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
      const wasClosing = closing;
      window.clearTimeout(closeTimer);
      closing = false;
      closeToken += 1;
      clearReaderAnimations();
      openId = task.id;
      activeVisible = visibleTasks;
      activeAll = allTasks;
      returnFocus = focus;
      suppressNextRestore = false;
      populate(task, visibleTasks, today);
      const wasOpen = dialog.open;
      if (!wasOpen) {
        dialog.showModal();
      }
      dialog.scrollTop = 0;
      closeBtn.focus();
      if (!wasOpen || wasClosing) {
        animateElement(
          'reader',
          dialog,
          [
            { transform: 'translate3d(0, 12px, 0)', opacity: 0 },
            { transform: 'translate3d(0, 0, 0)', opacity: 1 },
          ],
          { duration: 200, easing: EASE_OUT, fill: 'backwards' },
        );
      }
    },
    refresh(visibleTasks, allTasks, today = new Date()): void {
      if (openId === null || !dialog.open) return;
      activeVisible = visibleTasks;
      activeAll = allTasks;
      const task = allTasks.find((item) => item.id === openId);
      if (!task) {
        requestClose(false, true);
        return;
      }
      populate(task, visibleTasks, today);
    },
    pulseStatus(): void {
      animateElement(
        'status',
        statusEl,
        [
          { transform: 'translate3d(0, 4px, 0)', opacity: 0.55 },
          { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        ],
        { duration: 180, easing: EASE_OUT, fill: 'none' },
      );
      animateElement(
        'status',
        toggleBtn,
        [{ transform: 'scale(0.97)' }, { transform: 'scale(1)' }],
        { duration: 180, easing: EASE_OUT, fill: 'none' },
      );
    },
    close(restoreFocus = true): void {
      requestClose(restoreFocus, true);
    },
    isOpen(): boolean {
      return dialog.open;
    },
    currentTaskId(): number | null {
      return openId;
    },
  };
}
