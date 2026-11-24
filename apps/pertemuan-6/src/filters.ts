import { countByStatus } from './tasks.ts';
import type { Task, TaskList, TaskStatus } from './types.ts';

/** Pilihan filter tampilan; hanya state UI sementara, tidak pernah disimpan. */
export const TASK_FILTERS = ['all', 'active', 'completed'] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

export const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'Semua',
  active: 'Belum selesai',
  completed: 'Selesai',
};

/** Status yang cocok untuk tiap filter selain `all`. */
const FILTER_STATUS: Record<Exclude<TaskFilter, 'all'>, TaskStatus> = {
  active: 'belum-selesai',
  completed: 'selesai',
};

export function isTaskFilter(value: unknown): value is TaskFilter {
  return (TASK_FILTERS as readonly unknown[]).includes(value);
}

/** Tugas yang cocok dengan filter; objek asli dan urutannya dipertahankan, array sumber tidak berubah. */
export function filterTasks(tasks: TaskList, filter: TaskFilter): Task[] {
  if (filter === 'all') return [...tasks];
  const status = FILTER_STATUS[filter];
  return tasks.filter((task) => task.status === status);
}

/** Jumlah per filter, selalu dihitung dari seluruh daftar (bukan hasil filter). */
export function filterCounts(tasks: TaskList): Record<TaskFilter, number> {
  const byStatus = countByStatus(tasks);
  return { all: tasks.length, active: byStatus['belum-selesai'], completed: byStatus.selesai };
}

/** Menormalkan query pencarian: trim, lowercase, dan rapatkan spasi berulang. */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Mengembalikan true jika tugas cocok dengan query ternormalisasi pada judul, matkul, kategori, atau deskripsi. */
export function matchesSearchQuery(task: Task, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true;
  const fields = [task.title, task.course, task.category, task.description];
  return fields.some((field) => typeof field === 'string' && normalizeSearchQuery(field).includes(normalizedQuery));
}

/** Menyaring tugas berdasarkan filter status dan query pencarian secara bersamaan. */
export function queryTasks(tasks: TaskList, filter: TaskFilter, query: string): Task[] {
  const statusFiltered = filterTasks(tasks, filter);
  const normalized = normalizeSearchQuery(query);
  if (normalized === '') return statusFiltered;
  return statusFiltered.filter((task) => matchesSearchQuery(task, normalized));
}
