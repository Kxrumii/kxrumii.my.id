import { parseCalendarDate } from './tasks.ts';
import type { TaskDraft } from './types.ts';

/** Nilai mentah form (semua string, belum divalidasi). */
export interface RawTaskDraft {
  title: string;
  course: string;
  category?: string;
  description?: string;
  deadline: string;
}

export type DraftField = 'title' | 'course' | 'deadline';
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Hasil validasi: nilai valid atau daftar error; dipakai bareng mode tambah dan edit. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E };

/** Urutan field sama kayak form; dipakai buat nentuin field invalid pertama. */
export const DRAFT_FIELD_ORDER: readonly DraftField[] = ['title', 'course', 'deadline'];

export const ERROR_MESSAGES: Record<DraftField, string> = {
  title: 'Judul tugas wajib diisi.',
  course: 'Mata kuliah wajib diisi.',
  deadline: 'Tenggat harus berupa tanggal yang valid dengan format TTTT-BB-HH, atau kosongkan.',
};

/**
 * Validasi dan normalisasi input form.
 * - `title` dan `course`: wajib, setelah di-trim.
 * - `deadline`: opsional; kosong jadi `null`, selain itu harus tanggal kalender `YYYY-MM-DD` yang valid.
 */
export function validateDraft(raw: RawTaskDraft): Result<TaskDraft, DraftErrors> {
  const title = raw.title.trim();
  const course = raw.course.trim();
  const category = (raw.category ?? '').trim();
  const description = (raw.description ?? '').trim();
  const deadlineText = raw.deadline.trim();

  const errors: DraftErrors = {};
  if (title === '') errors.title = ERROR_MESSAGES.title;
  if (course === '') errors.course = ERROR_MESSAGES.course;
  if (deadlineText !== '' && parseCalendarDate(deadlineText) === null) errors.deadline = ERROR_MESSAGES.deadline;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const value: TaskDraft = {
    title,
    course,
    deadline: deadlineText === '' ? null : deadlineText,
  };
  if (category !== '') value.category = category;
  if (description !== '') value.description = description;
  return { ok: true, value };
}

/** Field invalid pertama menurut urutan form, atau `null` kalau nggak ada error. */
export function firstInvalidField(errors: DraftErrors): DraftField | null {
  return DRAFT_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}
