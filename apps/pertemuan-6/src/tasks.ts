import type { DeadlineState, Task, TaskDraft, TaskList, TaskStatus } from './types.ts';

/** Ganti item ber-`id` sama lewat `update`; item lain dan array asli nggak berubah. */
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
  const category = (draft.category ?? '').trim();
  const description = (draft.description ?? '').trim();
  const task: Task = {
    id: nextId(tasks),
    title: draft.title.trim(),
    course: draft.course.trim(),
    deadline: draft.deadline,
    status: 'belum-selesai',
  };
  if (category !== '') task.category = category;
  if (description !== '') task.description = description;
  return [...tasks, task];
}

export function updateTask(tasks: TaskList, id: number, draft: TaskDraft): Task[] {
  const category = (draft.category ?? '').trim();
  const description = (draft.description ?? '').trim();
  return updateById(tasks, id, (task) => {
    const next: Task = {
      id: task.id,
      title: draft.title.trim(),
      course: draft.course.trim(),
      deadline: draft.deadline,
      status: task.status,
    };
    if (category !== '') next.category = category;
    if (description !== '') next.description = description;
    return next;
  });
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

/** Parse `YYYY-MM-DD` jadi tanggal kalender lokal; `null` kalau format salah atau tanggalnya nggak ada (mis. 2026-02-30). */
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

const DEADLINE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Format `YYYY-MM-DD` ke tanggal lokal (tanpa geseran UTC); `null`/invalid jadi "—". */
export function formatDeadline(deadline: string | null): string {
  if (deadline === null) return '—';
  const date = parseCalendarDate(deadline);
  if (date === null) return '—';
  return DEADLINE_FORMATTER.format(date);
}

/** Id tugas tersisa yang paling dekat ke `removedId` (berikutnya, atau sebelumnya kalau yang terakhir); `null` kalau kosong. */
export function survivorId(tasks: TaskList, removedId: number): number | null {
  const index = tasks.findIndex((task) => task.id === removedId);
  if (index === -1) return null;
  const neighbour = tasks[index + 1] ?? tasks[index - 1];
  return neighbour?.id ?? null;
}

/** Nomor hari kalender lokal (tanpa jam, zona waktu, atau DST) buat bandingin tanggal. */
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * Urgensi tenggat dari kalender lokal `today` yang di-inject.
 * Tugas selesai, tenggat kosong, atau tenggat invalid hasilnya `'none'`.
 */
export function deadlineState(deadline: string | null, status: TaskStatus, today: Date): DeadlineState {
  if (status === 'selesai' || deadline === null) return 'none';
  const due = parseCalendarDate(deadline);
  if (due === null) return 'none';
  const diff = dayNumber(due) - dayNumber(today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return 'upcoming';
}

/** Label tampilan; kosong kalau nggak perlu ditandai. */
export function deadlineLabel(state: DeadlineState): string {
  switch (state) {
    case 'overdue':
      return 'Lewat tenggat';
    case 'today':
      return 'Hari ini';
    case 'tomorrow':
      return 'Besok';
    default:
      return '';
  }
}
