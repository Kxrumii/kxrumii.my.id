import { animateTaskDialogOpen } from './motion.ts';
import { requireElement } from './render.ts';
import type { Task } from './types.ts';

/** Elemen tujuan pemulihan fokus; `deleted` true kalau tugas dihapus. Dipanggil pas dialog nutup. */
export type DeleteFocusTarget = (deleted: boolean) => HTMLElement | null;

export interface DeleteDialog {
  open(task: Task, returnFocus: DeleteFocusTarget): void;
}

/**
 * Dialog konfirmasi hapus pakai `<dialog>` native. Judul tugas ditulis lewat `textContent`.
 * Hapus cuma terjadi lewat submit eksplisit; Batal dan Escape nutup tanpa efek.
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
    // Klik/Enter ganda diabaikan: id dikosongkan di konfirmasi pertama.
    if (pendingId === null) return;
    const id = pendingId;
    pendingId = null;
    deleted = true;
    confirm.disabled = true;
    dialog.close();
    onConfirm(id);
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
      const wasOpen = dialog.open;
      if (!wasOpen) {
        dialog.showModal();
        animateTaskDialogOpen(dialog);
      }
      cancel.focus();
    },
  };
}
