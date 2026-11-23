export type TaskStatus = 'belum-selesai' | 'selesai';

export interface Task {
  id: number;
  title: string;
  course: string;
  /** Tanggal kalender `YYYY-MM-DD`, atau `null` bila tidak ada tenggat. */
  deadline: string | null;
  status: TaskStatus;
}

export interface TaskDraft {
  title: string;
  course: string;
  deadline: string | null;
}

export type TaskList = readonly Task[];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'belum-selesai': 'Belum selesai',
  selesai: 'Selesai',
};
