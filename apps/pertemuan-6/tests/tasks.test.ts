import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countByStatus,
  createTask,
  formatDeadline,
  nextId,
  removeTask,
  toggleStatus,
  updateById,
  updateTask,
} from '../src/tasks.ts';
import type { Task, TaskDraft } from '../src/types.ts';

const draft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  title: 'Laporan praktikum',
  course: 'Basis Data',
  deadline: '2026-12-12',
  ...overrides,
});

const sample = (): readonly Task[] =>
  Object.freeze([
    Object.freeze<Task>({ id: 1, title: 'A', course: '', deadline: null, status: 'selesai' }),
    Object.freeze<Task>({ id: 4, title: 'B', course: 'PAW', deadline: null, status: 'belum-selesai' }),
  ]);

describe('nextId', () => {
  it('mulai dari 1 pada daftar kosong', () => {
    assert.equal(nextId([]), 1);
  });

  it('memakai id tertinggi + 1 meskipun ada celah', () => {
    assert.equal(nextId(sample()), 5);
  });
});

describe('createTask', () => {
  it('menambahkan tugas baru berstatus belum-selesai dengan teks yang di-trim', () => {
    const result = createTask(sample(), draft({ title: '  Resume jurnal  ', course: ' PAW ' }));
    assert.equal(result.length, 3);
    assert.deepEqual(result[2], {
      id: 5,
      title: 'Resume jurnal',
      course: 'PAW',
      deadline: '2026-12-12',
      status: 'belum-selesai',
    });
  });

  it('tidak memutasi array asli', () => {
    const original = sample();
    createTask(original, draft());
    assert.equal(original.length, 2);
  });
});

describe('updateTask', () => {
  it('hanya mengubah tugas target dan mempertahankan id serta status', () => {
    const original = sample();
    const result = updateTask(original, 1, draft({ title: 'Baru', deadline: null }));
    assert.deepEqual(result[0], { id: 1, title: 'Baru', course: 'Basis Data', deadline: null, status: 'selesai' });
    assert.equal(result[1], original[1]);
  });

  it('id tidak dikenal tidak mengubah isi', () => {
    assert.deepEqual(updateTask(sample(), 99, draft()), [...sample()]);
  });
});

describe('toggleStatus', () => {
  it('membalik status dua arah', () => {
    const once = toggleStatus(sample(), 4);
    assert.equal(once[1]?.status, 'selesai');
    assert.equal(toggleStatus(once, 4)[1]?.status, 'belum-selesai');
  });

  it('tidak menyentuh tugas lain', () => {
    assert.equal(toggleStatus(sample(), 4)[0]?.status, 'selesai');
  });
});

describe('removeTask', () => {
  it('menghapus tugas target saja', () => {
    assert.deepEqual(
      removeTask(sample(), 1).map((task) => task.id),
      [4],
    );
  });

  it('id tidak dikenal tidak mengubah isi', () => {
    assert.equal(removeTask(sample(), 99).length, 2);
  });
});

describe('updateById (generik)', () => {
  it('bekerja untuk tipe lain yang punya id numerik', () => {
    interface Label {
      id: number;
      name: string;
    }
    const labels: readonly Label[] = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    assert.deepEqual(
      updateById(labels, 2, (label) => ({ ...label, name: 'z' })),
      [
        { id: 1, name: 'a' },
        { id: 2, name: 'z' },
      ],
    );
  });
});

describe('countByStatus', () => {
  it('menghitung per status', () => {
    assert.deepEqual(countByStatus(sample()), { 'belum-selesai': 1, selesai: 1 });
    assert.deepEqual(countByStatus([]), { 'belum-selesai': 0, selesai: 0 });
  });
});

describe('input berbahaya', () => {
  it('disimpan apa adanya sebagai string; pelindung XSS ada di lapisan render', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const result = createTask([], draft({ title: payload }));
    assert.equal(result[0]?.title, payload);
    assert.equal(typeof result[0]?.title, 'string');
  });
});

describe('formatDeadline', () => {
  it('null menjadi strip', () => {
    assert.equal(formatDeadline(null), '—');
  });

  it('tanggal valid diformat id-ID tanpa pergeseran hari', () => {
    const text = formatDeadline('2026-12-12');
    assert.match(text, /12/);
    assert.match(text, /2026/);
  });

  it('tanggal kalender tidak valid menjadi strip', () => {
    assert.equal(formatDeadline('2026-02-30'), '—');
    assert.equal(formatDeadline('bukan-tanggal'), '—');
  });
});
