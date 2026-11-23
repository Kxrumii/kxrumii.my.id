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
