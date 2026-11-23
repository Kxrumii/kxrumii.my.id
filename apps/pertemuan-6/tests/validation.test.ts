import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTask, parseCalendarDate, updateTask } from '../src/tasks.ts';
import type { Task } from '../src/types.ts';
import { ERROR_MESSAGES, firstInvalidField, validateDraft } from '../src/validation.ts';

const raw = (overrides: Partial<{ title: string; course: string; deadline: string }> = {}) => ({
  title: 'Laporan praktikum',
  course: 'Basis Data',
  deadline: '2026-12-12',
  ...overrides,
});

describe('validateDraft — judul dan mata kuliah', () => {
  it('menerima input valid dan melakukan trim', () => {
    const result = validateDraft(raw({ title: '  Resume  ', course: '\tPAW\n' }));
    assert.deepEqual(result, { ok: true, value: { title: 'Resume', course: 'PAW', deadline: '2026-12-12' } });
  });

  it('menolak judul kosong dan judul hanya spasi', () => {
    for (const title of ['', '   ', '\t\n ']) {
      const result = validateDraft(raw({ title }));
      assert.equal(result.ok, false);
      assert.deepEqual(!result.ok && result.errors, { title: ERROR_MESSAGES.title });
    }
  });

  it('menolak mata kuliah kosong dan hanya spasi', () => {
    for (const course of ['', '    ']) {
      const result = validateDraft(raw({ course }));
      assert.deepEqual(!result.ok && result.errors, { course: ERROR_MESSAGES.course });
    }
  });

  it('tidak membatasi panjang dan tidak menolak judul yang sama dengan tugas lain', () => {
    assert.equal(validateDraft(raw({ title: 'x'.repeat(5000) })).ok, true);
    const existing: Task[] = [{ id: 1, title: 'Laporan praktikum', course: 'Basis Data', deadline: null, status: 'belum-selesai' }];
    const result = validateDraft(raw());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(createTask(existing, result.value).length, 2);
  });

  it('mengizinkan markup sebagai teks biasa (pelindung ada di lapisan render)', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const result = validateDraft(raw({ title: payload, course: payload }));
    assert.deepEqual(result.ok && result.value.title, payload);
    assert.deepEqual(result.ok && result.value.course, payload);
  });
});

describe('validateDraft — tenggat', () => {
  it('tenggat kosong atau spasi menjadi null', () => {
    for (const deadline of ['', '   ']) {
      const result = validateDraft(raw({ deadline }));
      assert.deepEqual(result.ok && result.value.deadline, null);
    }
  });

  it('menerima tanggal kalender valid, termasuk 29 Februari tahun kabisat dan tanggal lampau', () => {
    for (const deadline of ['2026-12-31', '2028-02-29', '2000-01-01']) {
      const result = validateDraft(raw({ deadline }));
      assert.deepEqual(result.ok && result.value.deadline, deadline);
    }
  });

  it('menolak tanggal yang tidak ada di kalender atau berformat salah', () => {
    for (const deadline of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-12-00', '12-12-2026', '2026/12/12', 'besok', '2026-1-5']) {
      const result = validateDraft(raw({ deadline }));
      assert.equal(result.ok, false, deadline);
      assert.deepEqual(!result.ok && result.errors, { deadline: ERROR_MESSAGES.deadline });
    }
  });
});

describe('validateDraft — beberapa kesalahan', () => {
  it('mengumpulkan semua kesalahan dan firstInvalidField mengikuti urutan form', () => {
    const result = validateDraft({ title: ' ', course: '', deadline: 'x' });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.errors).sort(), ['course', 'deadline', 'title']);
    assert.equal(firstInvalidField(result.errors), 'title');
    assert.equal(firstInvalidField({ deadline: 'x' }), 'deadline');
    assert.equal(firstInvalidField({}), null);
  });
});

describe('parseCalendarDate', () => {
  it('mengembalikan tanggal lokal yang tepat atau null', () => {
    const date = parseCalendarDate('2026-12-12');
    assert.equal(date?.getFullYear(), 2026);
    assert.equal(date?.getMonth(), 11);
    assert.equal(date?.getDate(), 12);
    assert.equal(parseCalendarDate('2026-02-30'), null);
  });
});

describe('validasi + operasi tugas (alur edit)', () => {
  it('mengedit mempertahankan id dan status, tanpa membuat duplikat', () => {
    const tasks: Task[] = [
      { id: 3, title: 'Lama', course: 'PAW', deadline: null, status: 'selesai' },
      { id: 7, title: 'Lain', course: 'SO', deadline: null, status: 'belum-selesai' },
    ];
    const result = validateDraft(raw({ title: '  Baru  ', deadline: '' }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const updated = updateTask(tasks, 3, result.value);
    assert.equal(updated.length, 2);
    assert.deepEqual(updated[0], { id: 3, title: 'Baru', course: 'Basis Data', deadline: null, status: 'selesai' });
    assert.equal(updated[1], tasks[1]);
  });

  it('input tidak valid tidak menghasilkan draft sehingga daftar tidak berubah', () => {
    const tasks: Task[] = [{ id: 1, title: 'A', course: 'B', deadline: null, status: 'belum-selesai' }];
    const result = validateDraft(raw({ title: ' ' }));
    assert.equal(result.ok, false);
    assert.equal(tasks.length, 1);
  });

  it('membuat tugas baru memakai id berikutnya dan status awal belum-selesai', () => {
    const result = validateDraft(raw());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const created = createTask([{ id: 4, title: 'A', course: 'B', deadline: null, status: 'selesai' }], result.value);
    assert.equal(created[1]?.id, 5);
    assert.equal(created[1]?.status, 'belum-selesai');
  });
});
