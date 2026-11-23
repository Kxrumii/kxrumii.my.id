import { parseCalendarDate } from './tasks.ts';
import type { TaskDraft } from './types.ts';

/** Nilai mentah dari form (semua string, belum divalidasi). */
export interface RawTaskDraft {
  title: string;
  course: string;
  deadline: string;
}

export type DraftField = keyof TaskDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Hasil yang membawa nilai valid atau daftar kesalahan; dipakai bersama oleh mode tambah dan edit. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E };

/** Urutan field seperti pada form; dipakai untuk menentukan field invalid pertama. */
export const DRAFT_FIELD_ORDER: readonly DraftField[] = ['title', 'course', 'deadline'];

export const ERROR_MESSAGES: Record<DraftField, string> = {
  title: 'Judul tugas wajib diisi.',
  course: 'Mata kuliah wajib diisi.',
  deadline: 'Tenggat harus berupa tanggal yang valid dengan format TTTT-BB-HH, atau kosongkan.',
};

/**
 * Memvalidasi dan menormalkan input form.
 * - `title` dan `course`: wajib setelah di-trim.
 * - `deadline`: opsional; kosong menjadi `null`, selain itu harus tanggal kalender `YYYY-MM-DD` yang ada.
 */
export function validateDraft(raw: RawTaskDraft): Result<TaskDraft, DraftErrors> {
  const title = raw.title.trim();
  const course = raw.course.trim();
  const deadlineText = raw.deadline.trim();

  const errors: DraftErrors = {};
  if (title === '') errors.title = ERROR_MESSAGES.title;
  if (course === '') errors.course = ERROR_MESSAGES.course;
  if (deadlineText !== '' && parseCalendarDate(deadlineText) === null) errors.deadline = ERROR_MESSAGES.deadline;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { title, course, deadline: deadlineText === '' ? null : deadlineText } };
}

/** Field invalid pertama menurut urutan form, atau `null` bila tidak ada kesalahan. */
export function firstInvalidField(errors: DraftErrors): DraftField | null {
  return DRAFT_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}
