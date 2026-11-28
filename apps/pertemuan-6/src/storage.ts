import { parseCalendarDate } from './tasks.ts';
import type { Task, TaskStatus, ViewMode } from './types.ts';

export const STORAGE_KEY = 'kxrumii:pertemuan-6:tasks:v1';
export const STORAGE_VERSION = 1;
export const VIEW_MODE_KEY = 'kxrumii-task6-view-mode';
export const DEFAULT_VIEW_MODE: ViewMode = 'list';

/** Subset `Storage` yang dipakai app; gampang di-inject di test. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Bentuk data tersimpan: envelope ber-versi, bukan array polos. */
export interface StoredTasks {
  version: typeof STORAGE_VERSION;
  tasks: readonly Task[];
}

export type LoadIssue = 'unavailable' | 'invalid-data' | 'unsupported-version';
export type SaveFailure = 'unavailable' | 'save-failed';

export interface LoadResult {
  tasks: Task[];
  /** Jumlah record tugas yang dilewati karena invalid atau id ganda. */
  skipped: number;
  /** `null` kalau storage kebaca dengan baik (termasuk kalau belum ada data). */
  issue: LoadIssue | null;
}

export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure };

const STATUSES: readonly TaskStatus[] = ['belum-selesai', 'selesai'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Validasi runtime satu record tugas dari data yang nggak dipercaya. */
export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const { id, title, course, category, description, deadline, status } = value;
  return (
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    isNonEmptyText(title) &&
    isNonEmptyText(course) &&
    (category === undefined || typeof category === 'string') &&
    (description === undefined || typeof description === 'string') &&
    (deadline === null || (typeof deadline === 'string' && parseCalendarDate(deadline) !== null)) &&
    typeof status === 'string' &&
    (STATUSES as readonly string[]).includes(status)
  );
}

export function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'orbit';
}

/** Baca preferensi mode tampilan; selalu fallback aman ke `list`. */
export function loadViewMode(storage: StorageLike | null): ViewMode {
  if (storage === null) return DEFAULT_VIEW_MODE;
  try {
    const raw = storage.getItem(VIEW_MODE_KEY);
    return isViewMode(raw) ? raw : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

/** Simpan preferensi mode tampilan. Nggak pernah throw. */
export function saveViewMode(storage: StorageLike | null, mode: ViewMode): SaveResult {
  if (storage === null) return { ok: false, reason: 'unavailable' };
  try {
    storage.setItem(VIEW_MODE_KEY, mode);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'save-failed' };
  }
}

/** Ambil `localStorage` kalau bisa diakses; accessor-nya sendiri bisa throw. */
export function getBrowserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Baca dan validasi daftar tugas. Nggak pernah throw dan nggak nulis ke storage.
 * Record valid dipertahankan; record invalid dan id ganda dilewati lalu dihitung.
 */
export function loadTasks(storage: StorageLike | null): LoadResult {
  const empty = (issue: LoadIssue | null, skipped = 0): LoadResult => ({ tasks: [], skipped, issue });
  if (storage === null) return empty('unavailable');

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return empty('unavailable');
  }
  if (raw === null) return empty(null);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty('invalid-data');
  }
  if (!isRecord(parsed) || typeof parsed.version !== 'number' || !Array.isArray(parsed.tasks)) {
    return empty('invalid-data');
  }
  if (parsed.version !== STORAGE_VERSION) return empty('unsupported-version');

  const tasks: Task[] = [];
  const seen = new Set<number>();
  let skipped = 0;
  for (const record of parsed.tasks as unknown[]) {
    if (!isTask(record) || seen.has(record.id)) {
      skipped += 1;
      continue;
    }
    seen.add(record.id);
    // Salin cuma field yang dikenal; properti ekstra nggak ikut dipulihkan.
    const item: Task = {
      id: record.id,
      title: record.title,
      course: record.course,
      deadline: record.deadline,
      status: record.status,
    };
    const category = (record.category ?? '').trim();
    const description = (record.description ?? '').trim();
    if (category !== '') item.category = category;
    if (description !== '') item.description = description;
    tasks.push(item);
  }
  return { tasks, skipped, issue: null };
}

/** Simpan daftar tugas dalam envelope ber-versi. Nggak pernah throw. */
export function saveTasks(storage: StorageLike | null, tasks: readonly Task[]): SaveResult {
  if (storage === null) return { ok: false, reason: 'unavailable' };
  const payload: StoredTasks = { version: STORAGE_VERSION, tasks };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'save-failed' };
  }
}

/** Pesan buat pengguna soal hasil pembacaan; `null` kalau nggak ada masalah. */
export function describeLoad(result: LoadResult): string | null {
  switch (result.issue) {
    case 'unavailable':
      return 'Penyimpanan peramban tidak dapat diakses. Tugas hanya tersimpan sementara dan akan hilang saat halaman dimuat ulang.';
    case 'invalid-data':
      return 'Data tersimpan tidak valid dan diabaikan, sehingga daftar dimulai kosong. Perubahan berikutnya akan menimpa data lama.';
    case 'unsupported-version':
      return 'Data tersimpan memakai versi format yang tidak didukung dan diabaikan, sehingga daftar dimulai kosong. Perubahan berikutnya akan menimpa data lama.';
    case null:
      return result.skipped > 0
        ? `${result.skipped} data tugas tidak valid dilewati. Perubahan berikutnya hanya menyimpan data yang valid.`
        : null;
  }
}

/** Pesan buat pengguna kalau penyimpanan gagal. */
export function describeSaveFailure(reason: SaveFailure): string {
  return reason === 'unavailable'
    ? 'Perubahan tidak dapat disimpan karena penyimpanan peramban tidak dapat diakses. Tugas tetap dapat dipakai, tetapi akan hilang saat halaman dimuat ulang.'
    : 'Perubahan gagal disimpan (penyimpanan penuh atau ditolak). Tugas tetap dapat dipakai, tetapi akan hilang saat halaman dimuat ulang.';
}
