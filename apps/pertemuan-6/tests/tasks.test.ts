import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countByStatus,
  deadlineLabel,
  deadlineState,
  createTask,
  formatDeadline,
  nextId,
  removeTask,
  survivorId,
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

describe('survivorId', () => {
  const list = (): readonly Task[] => [
    { id: 1, title: 'A', course: '', deadline: null, status: 'belum-selesai' },
    { id: 4, title: 'B', course: '', deadline: null, status: 'belum-selesai' },
    { id: 9, title: 'C', course: '', deadline: null, status: 'belum-selesai' },
  ];

  it('memilih tugas berikutnya, atau sebelumnya bila yang dihapus terakhir', () => {
    assert.equal(survivorId(list(), 1), 4);
    assert.equal(survivorId(list(), 4), 9);
    assert.equal(survivorId(list(), 9), 4);
  });

  it('null bila tidak ada sisa atau id tidak dikenal', () => {
    assert.equal(survivorId([list()[0] as Task], 1), null);
    assert.equal(survivorId(list(), 99), null);
  });
});

describe('toggleStatus dan ringkasan', () => {
  it('hitungan per status mengikuti pembalikan dua arah dan id tetap', () => {
    const base = sample();
    const done = toggleStatus(base, 4);
    assert.deepEqual(countByStatus(done), { 'belum-selesai': 0, selesai: 2 });
    assert.equal(done[1]?.id, 4);
    assert.deepEqual(countByStatus(toggleStatus(done, 4)), { 'belum-selesai': 1, selesai: 1 });
  });
});

describe('deadlineState', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

  it('kemarin → overdue, hari ini → today, besok → tomorrow, beberapa hari lagi → upcoming', () => {
    const today = at(2026, 11, 23);
    assert.equal(deadlineState('2026-11-22', 'belum-selesai', today), 'overdue');
    assert.equal(deadlineState('2026-10-01', 'belum-selesai', today), 'overdue');
    assert.equal(deadlineState('2026-11-23', 'belum-selesai', today), 'today');
    assert.equal(deadlineState('2026-11-24', 'belum-selesai', today), 'tomorrow');
    assert.equal(deadlineState('2026-11-25', 'belum-selesai', today), 'upcoming');
    assert.equal(deadlineState('2027-06-01', 'belum-selesai', today), 'upcoming');
  });

  it('jam pada hari ini tidak memengaruhi hasil', () => {
    assert.equal(deadlineState('2026-11-23', 'belum-selesai', at(2026, 11, 23, 0, 0)), 'today');
    assert.equal(deadlineState('2026-11-23', 'belum-selesai', at(2026, 11, 23, 23, 59)), 'today');
    assert.equal(deadlineState('2026-11-24', 'belum-selesai', at(2026, 11, 23, 23, 59)), 'tomorrow');
  });

  it('null, kosong, atau tidak valid → none', () => {
    const today = at(2026, 11, 23);
    assert.equal(deadlineState(null, 'belum-selesai', today), 'none');
    assert.equal(deadlineState('', 'belum-selesai', today), 'none');
    assert.equal(deadlineState('2026-02-30', 'belum-selesai', today), 'none');
    assert.equal(deadlineState('besok', 'belum-selesai', today), 'none');
  });

  it('tugas selesai selalu none, termasuk yang lewat tenggat', () => {
    const today = at(2026, 11, 23);
    assert.equal(deadlineState('2026-11-01', 'selesai', today), 'none');
    assert.equal(deadlineState('2026-11-23', 'selesai', today), 'none');
    assert.equal(deadlineState('2026-11-24', 'selesai', today), 'none');
  });

  it('batas pergantian bulan, tahun, dan 29 Februari', () => {
    assert.equal(deadlineState('2026-12-01', 'belum-selesai', at(2026, 11, 30)), 'tomorrow');
    assert.equal(deadlineState('2026-11-29', 'belum-selesai', at(2026, 11, 30)), 'overdue');
    assert.equal(deadlineState('2026-02-01', 'belum-selesai', at(2026, 1, 31)), 'tomorrow');
    assert.equal(deadlineState('2027-01-01', 'belum-selesai', at(2026, 12, 31)), 'tomorrow');
    assert.equal(deadlineState('2026-12-31', 'belum-selesai', at(2027, 1, 1)), 'overdue');
    assert.equal(deadlineState('2028-02-29', 'belum-selesai', at(2028, 2, 28)), 'tomorrow');
    assert.equal(deadlineState('2028-03-01', 'belum-selesai', at(2028, 2, 28)), 'upcoming');
  });

  it('melintasi pergeseran DST tetap menghitung selisih hari kalender', () => {
    assert.equal(deadlineState('2026-03-09', 'belum-selesai', at(2026, 3, 8)), 'tomorrow');
    assert.equal(deadlineState('2026-11-02', 'belum-selesai', at(2026, 11, 1)), 'tomorrow');
  });
});

describe('deadlineLabel', () => {
  it('label hanya untuk keadaan yang perlu ditandai', () => {
    assert.equal(deadlineLabel('overdue'), 'Lewat tenggat');
    assert.equal(deadlineLabel('today'), 'Hari ini');
    assert.equal(deadlineLabel('tomorrow'), 'Besok');
    assert.equal(deadlineLabel('upcoming'), '');
    assert.equal(deadlineLabel('none'), '');
  });
});

describe('createTask, updateTask, dan cache formatDeadline untuk skema S2', () => {
  it('menyertakan category dan description non-kosong serta menghapusnya saat dikosongkan pada edit', () => {
    const created = createTask([], {
      title: 'Proyek',
      course: 'PAW',
      category: '  Praktikum ',
      description: '  Buat aplikasi ',
      deadline: null,
    });
    assert.deepEqual(created[0], {
      id: 1,
      title: 'Proyek',
      course: 'PAW',
      category: 'Praktikum',
      description: 'Buat aplikasi',
      deadline: null,
      status: 'belum-selesai',
    });

    const cleared = updateTask(created, 1, {
      title: 'Proyek',
      course: 'PAW',
      deadline: null,
    });
    assert.deepEqual(Object.keys(cleared[0] as Task).sort(), ['course', 'deadline', 'id', 'status', 'title']);
  });

  it('formatDeadline konsisten pada pemanggilan berulang', () => {
    assert.equal(formatDeadline('2026-12-12'), formatDeadline('2026-12-12'));
    assert.equal(formatDeadline('2026-01-05'), formatDeadline('2026-01-05'));
  });
});
