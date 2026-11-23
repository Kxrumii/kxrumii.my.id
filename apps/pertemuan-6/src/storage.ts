import { parseCalendarDate } from './tasks.ts';
import type { Task, TaskStatus } from './types.ts';

export const STORAGE_KEY = 'kxrumii:pertemuan-6:tasks:v1';
export const STORAGE_VERSION = 1;

/** Subset `Storage` yang dipakai aplikasi; memudahkan injeksi pada test. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Bentuk data yang disimpan: envelope bernomor versi, bukan array polos. */
export interface StoredTasks {
  version: typeof STORAGE_VERSION;
  tasks: readonly Task[];
}

export type LoadIssue = 'unavailable' | 'invalid-data' | 'unsupported-version';
export type SaveFailure = 'unavailable' | 'save-failed';

export interface LoadResult {
  tasks: Task[];
  /** Jumlah record tugas yang dilewati karena tidak valid atau id ganda. */
  skipped: number;
  /** `null` bila penyimpanan terbaca dengan baik (termasuk bila belum ada data). */
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

/** Validasi runtime satu record tugas dari data yang tidak dipercaya. */
export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const { id, title, course, deadline, status } = value;
  return (
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    isNonEmptyText(title) &&
    isNonEmptyText(course) &&
    (deadline === null || (typeof deadline === 'string' && parseCalendarDate(deadline) !== null)) &&
    typeof status === 'string' &&
    (STATUSES as readonly string[]).includes(status)
  );
}

/** Mengambil `localStorage` bila dapat diakses; accessor-nya sendiri bisa melempar error. */
export function getBrowserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Membaca dan memvalidasi daftar tugas. Tidak pernah melempar error dan tidak menulis ke storage.
 * Record yang valid dipertahankan; record tidak valid dan id ganda dilewati dan dihitung.
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
    // Salin hanya field yang dikenal; properti tambahan tidak ikut dipulihkan.
    tasks.push({
      id: record.id,
      title: record.title,
      course: record.course,
      deadline: record.deadline,
      status: record.status,
    });
  }
  return { tasks, skipped, issue: null };
}

/** Menyimpan daftar tugas dalam envelope bernomor versi. Tidak pernah melempar error. */
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

/** Pesan untuk pengguna terkait hasil pembacaan; `null` bila tidak ada masalah. */
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

/** Pesan untuk pengguna saat penyimpanan gagal. */
export function describeSaveFailure(reason: SaveFailure): string {
  return reason === 'unavailable'
    ? 'Perubahan tidak dapat disimpan karena penyimpanan peramban tidak dapat diakses. Tugas tetap dapat dipakai, tetapi akan hilang saat halaman dimuat ulang.'
    : 'Perubahan gagal disimpan (penyimpanan penuh atau ditolak). Tugas tetap dapat dipakai, tetapi akan hilang saat halaman dimuat ulang.';
}
