import { animateTaskDialogOpen } from './motion.ts';
import { requireElement } from './render.ts';
import type { Task, TaskDraft } from './types.ts';
import { DRAFT_FIELD_ORDER, firstInvalidField, validateDraft, type DraftErrors, type DraftField } from './validation.ts';

export interface TaskDialogHandlers {
  onCreate(draft: TaskDraft): void;
  onEdit(id: number, draft: TaskDraft): void;
}

/** Elemen tujuan pemulihan fokus; dipanggil pas dialog nutup (setelah render ulang). */
export type FocusTarget = () => HTMLElement | null;

export interface TaskDialog {
  openCreate(returnFocus: FocusTarget): void;
  openEdit(task: Task, returnFocus: FocusTarget): void;
}

/**
 * Dialog tambah/edit pakai `<dialog>` native: `showModal()` sudah kasih focus trap,
 * background inert, dan tutup lewat Escape. Nilai pengguna cuma lewat `.value` dan `textContent`.
 */
export function initTaskDialog(root: ParentNode, handlers: TaskDialogHandlers): TaskDialog {
  const dialog = requireElement(root, '#task-dialog', HTMLDialogElement);
  const form = requireElement(root, '#task-form', HTMLFormElement);
  const heading = requireElement(root, '#task-dialog-title', HTMLElement);
  const cancel = requireElement(root, '#task-cancel', HTMLButtonElement);

  const categoryInput = requireElement(root, '#task-category', HTMLInputElement);
  const descriptionInput = requireElement(root, '#task-description', HTMLTextAreaElement);

  const inputs: Record<DraftField, HTMLInputElement> = {
    title: requireElement(root, '#task-title', HTMLInputElement),
    course: requireElement(root, '#task-course', HTMLInputElement),
    deadline: requireElement(root, '#task-deadline', HTMLInputElement),
  };
  const messages: Record<DraftField, HTMLElement> = {
    title: requireElement(root, '#task-title-error', HTMLElement),
    course: requireElement(root, '#task-course-error', HTMLElement),
    deadline: requireElement(root, '#task-deadline-error', HTMLElement),
  };

  let editingId: number | null = null;
  let returnFocus: FocusTarget = () => null;
  let deferCloseFocus = false;

  function clearErrors(): void {
    for (const field of DRAFT_FIELD_ORDER) {
      inputs[field].removeAttribute('aria-invalid');
      messages[field].textContent = '';
      messages[field].hidden = true;
    }
  }

  function showErrors(errors: DraftErrors): void {
    clearErrors();
    for (const field of DRAFT_FIELD_ORDER) {
      const message = errors[field];
      if (message === undefined) continue;
      inputs[field].setAttribute('aria-invalid', 'true');
      messages[field].textContent = message;
      messages[field].hidden = false;
    }
    const first = firstInvalidField(errors);
    if (first !== null) inputs[first].focus();
  }

  function open(title: string, values: TaskDraft, focus: FocusTarget, id: number | null): void {
    editingId = id;
    returnFocus = focus;
    heading.textContent = title;
    inputs.title.value = values.title;
    inputs.course.value = values.course;
    categoryInput.value = values.category ?? '';
    descriptionInput.value = values.description ?? '';
    inputs.deadline.value = values.deadline ?? '';
    clearErrors();
    const wasOpen = dialog.open;
    if (!wasOpen) {
      dialog.showModal();
      animateTaskDialogOpen(dialog);
    }
    inputs.title.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateDraft({
      title: inputs.title.value,
      course: inputs.course.value,
      category: categoryInput.value,
      description: descriptionInput.value,
      deadline: inputs.deadline.value,
    });
    if (!result.ok) {
      showErrors(result.errors);
      return;
    }
    const isCreate = editingId === null;
    const targetId = editingId;
    const focusAfterSubmit = returnFocus;
    deferCloseFocus = true;
    dialog.close();
    if (isCreate) {
      handlers.onCreate(result.value);
    } else if (targetId !== null) {
      handlers.onEdit(targetId, result.value);
    }
    focusAfterSubmit()?.focus();
  });

  cancel.addEventListener('click', () => dialog.close());

  // Berlaku buat simpan, batal, dan Escape. Fokus dipulihkan setelah daftar dirender ulang.
  dialog.addEventListener('close', () => {
    editingId = null;
    if (deferCloseFocus) {
      deferCloseFocus = false;
      return;
    }
    returnFocus()?.focus();
  });

  return {
    openCreate(focus) {
      open('Tambah tugas', { title: '', course: '', deadline: null }, focus, null);
    },
    openEdit(task, focus) {
      open(
        'Edit tugas',
        {
          title: task.title,
          course: task.course,
          category: task.category,
          description: task.description,
          deadline: task.deadline,
        },
        focus,
        task.id,
      );
    },
  };
}
