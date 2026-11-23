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

/** Urgensi tenggat yang diturunkan dari tanggal hari ini; bukan bagian dari data tersimpan. */
export type DeadlineState = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none';

/** Dua gaya latar bawaan tanpa gambar yang disetujui; tidak ada gaya transparan/outline. */
export type FallbackSurface = 'solid' | 'texture';

export type SolidTone = 'paper' | 'charcoal' | 'cobalt' | 'sand' | 'sage' | 'terracotta';

export type TexturePattern = 'grain' | 'dots' | 'grid';

export type BoxArchetype =
  | 'serif-split'
  | 'grotesk-block'
  | 'mixed-editorial'
  | 'scale-italic'
  | 'mono-hybrid'
  | 'condensed-poster';

export type BoxProportion = 'portrait' | 'landscape' | 'tall';

export type ViewMode = 'orbit' | 'list';
export type ViewPreference = 'auto' | ViewMode;

export interface BoxVisualSpec {
  archetype: BoxArchetype;
  surface: FallbackSurface;
  tone: SolidTone;
  texture: TexturePattern;
  proportion: BoxProportion;
  lines: readonly string[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'belum-selesai': 'Belum selesai',
  selesai: 'Selesai',
};
