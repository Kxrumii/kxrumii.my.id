import type { Task, TaskDraft, TaskList, TaskStatus } from './types.ts';

/** Mengganti item dengan `id` yang sama lewat `update`; item lain dan array asli tidak berubah. */
export function updateById<T extends { id: number }>(
  items: readonly T[],
  id: number,
  update: (item: T) => T,
): T[] {
  return items.map((item) => (item.id === id ? update(item) : item));
}

export function nextId(tasks: TaskList): number {
  return tasks.reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
}

export function createTask(tasks: TaskList, draft: TaskDraft): Task[] {
  const task: Task = {
    id: nextId(tasks),
    title: draft.title.trim(),
    course: draft.course.trim(),
    deadline: draft.deadline,
    status: 'belum-selesai',
  };
  return [...tasks, task];
}

export function updateTask(tasks: TaskList, id: number, draft: TaskDraft): Task[] {
  return updateById(tasks, id, (task) => ({
    ...task,
    title: draft.title.trim(),
    course: draft.course.trim(),
    deadline: draft.deadline,
  }));
}

export function toggleStatus(tasks: TaskList, id: number): Task[] {
  return updateById(tasks, id, (task) => ({
    ...task,
    status: task.status === 'selesai' ? 'belum-selesai' : 'selesai',
  }));
}

export function removeTask(tasks: TaskList, id: number): Task[] {
  return tasks.filter((task) => task.id !== id);
}

export function countByStatus(tasks: TaskList): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { 'belum-selesai': 0, selesai: 0 };
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

const DEADLINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Mem-parse `YYYY-MM-DD` sebagai tanggal kalender lokal; `null` bila format salah atau tanggal tidak ada (mis. 2026-02-30). */
export function parseCalendarDate(value: string): Date | null {
  const match = DEADLINE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Memformat `YYYY-MM-DD` sebagai tanggal lokal (tanpa pergeseran UTC); `null`/tidak valid menjadi "—". */
export function formatDeadline(deadline: string | null): string {
  if (deadline === null) return '—';
  const date = parseCalendarDate(deadline);
  if (date === null) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Id tugas yang tersisa dan paling dekat dengan posisi `removedId` (berikutnya, atau sebelumnya bila terakhir); `null` bila tidak ada. */
export function survivorId(tasks: TaskList, removedId: number): number | null {
  const index = tasks.findIndex((task) => task.id === removedId);
  if (index === -1) return null;
  const neighbour = tasks[index + 1] ?? tasks[index - 1];
  return neighbour?.id ?? null;
}
