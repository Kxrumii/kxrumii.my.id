import { requireElement } from './render.ts';
import type { Task } from './types.ts';

/** Menentukan elemen tempat fokus dipulihkan; `deleted` true bila tugas dihapus. Dievaluasi saat dialog menutup. */
export type DeleteFocusTarget = (deleted: boolean) => HTMLElement | null;

export interface DeleteDialog {
  open(task: Task, returnFocus: DeleteFocusTarget): void;
}

/**
 * Dialog konfirmasi hapus berbasis `<dialog>` native. Judul tugas ditulis lewat `textContent`.
 * Penghapusan hanya terjadi lewat submit eksplisit; Batal dan Escape menutup tanpa efek.
 */
export function initDeleteDialog(root: ParentNode, onConfirm: (id: number) => void): DeleteDialog {
  const dialog = requireElement(root, '#delete-dialog', HTMLDialogElement);
  const form = requireElement(root, '#delete-form', HTMLFormElement);
  const taskName = requireElement(root, '#delete-dialog-task', HTMLElement);
  const cancel = requireElement(root, '#delete-cancel', HTMLButtonElement);
  const confirm = requireElement(root, '#delete-confirm', HTMLButtonElement);

  let pendingId: number | null = null;
  let deleted = false;
  let returnFocus: DeleteFocusTarget = () => null;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Konfirmasi berulang (klik ganda/Enter ganda) diabaikan: id dikosongkan pada konfirmasi pertama.
    if (pendingId === null) return;
    const id = pendingId;
    pendingId = null;
    deleted = true;
    confirm.disabled = true;
    onConfirm(id);
    dialog.close();
  });

  cancel.addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', () => {
    pendingId = null;
    confirm.disabled = false;
    returnFocus(deleted)?.focus();
    deleted = false;
  });

  return {
    open(task, focus) {
      pendingId = task.id;
      deleted = false;
      returnFocus = focus;
      taskName.textContent = `“${task.title}”`;
      confirm.disabled = false;
      dialog.showModal();
      cancel.focus();
    },
  };
}
