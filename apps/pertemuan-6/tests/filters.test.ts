import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterCounts,
  filterTasks,
  isTaskFilter,
  matchesSearchQuery,
  normalizeSearchQuery,
  queryTasks,
  TASK_FILTERS,
} from '../src/filters.ts';
import { createTask, removeTask, toggleStatus } from '../src/tasks.ts';
import type { Task } from '../src/types.ts';

const tasks = (): readonly Task[] =>
  Object.freeze([
    Object.freeze<Task>({ id: 3, title: 'C', course: 'x', deadline: null, status: 'selesai' }),
    Object.freeze<Task>({ id: 1, title: 'A', course: 'x', deadline: null, status: 'belum-selesai' }),
    Object.freeze<Task>({ id: 2, title: 'B', course: 'x', deadline: null, status: 'selesai' }),
    Object.freeze<Task>({ id: 5, title: 'E', course: 'x', deadline: null, status: 'belum-selesai' }),
  ]);

describe('filterTasks', () => {
  it('all mengembalikan semua tugas dalam urutan asli', () => {
    assert.deepEqual(filterTasks(tasks(), 'all').map((t) => t.id), [3, 1, 2, 5]);
  });

  it('active hanya belum-selesai, completed hanya selesai, urutan tetap', () => {
    assert.deepEqual(filterTasks(tasks(), 'active').map((t) => t.id), [1, 5]);
    assert.deepEqual(filterTasks(tasks(), 'completed').map((t) => t.id), [3, 2]);
  });

  it('mempertahankan objek asli dan tidak memutasi array sumber', () => {
    const source = tasks();
    const result = filterTasks(source, 'active');
    assert.equal(result[0], source[1]);
    assert.equal(source.length, 4);
    assert.notEqual(filterTasks(source, 'all'), source);
  });

  it('daftar kosong atau tanpa hasil menghasilkan array kosong', () => {
    assert.deepEqual(filterTasks([], 'completed'), []);
    assert.deepEqual(filterTasks([tasks()[1] as Task], 'completed'), []);
  });
});

describe('filterCounts', () => {
  it('dihitung dari seluruh daftar', () => {
    assert.deepEqual(filterCounts(tasks()), { all: 4, active: 2, completed: 2 });
    assert.deepEqual(filterCounts([]), { all: 0, active: 0, completed: 0 });
  });

  it('jumlah semua = aktif + selesai dan tidak bergantung pada hasil filter', () => {
    const counts = filterCounts(tasks());
    assert.equal(counts.all, counts.active + counts.completed);
    assert.equal(counts.active, filterTasks(tasks(), 'active').length);
  });

  it('mengikuti tambah, ubah status, dan hapus', () => {
    let list: readonly Task[] = tasks();
    list = createTask(list, { title: 'Baru', course: 'y', deadline: null });
    assert.deepEqual(filterCounts(list), { all: 5, active: 3, completed: 2 });
    list = toggleStatus(list, 1);
    assert.deepEqual(filterCounts(list), { all: 5, active: 2, completed: 3 });
    list = removeTask(list, 3);
    assert.deepEqual(filterCounts(list), { all: 4, active: 2, completed: 2 });
  });

  it('tugas yang berubah status hilang dari filter lamanya tanpa terhapus dari daftar', () => {
    const after = toggleStatus(tasks(), 1);
    assert.deepEqual(filterTasks(after, 'active').map((t) => t.id), [5]);
    assert.equal(after.length, 4);
  });
});

describe('isTaskFilter', () => {
  it('menerima tepat tiga nilai', () => {
    for (const value of TASK_FILTERS) assert.equal(isTaskFilter(value), true);
    for (const value of ['', 'ALL', 'done', null, undefined, 1]) assert.equal(isTaskFilter(value), false);
  });
});

describe('normalizeSearchQuery, matchesSearchQuery, dan queryTasks', () => {
  const richTasks = (): readonly Task[] =>
    Object.freeze([
      Object.freeze<Task>({
        id: 1,
        title: 'Normalisasi Basis Data',
        course: 'Sistem Basis Data',
        category: 'Praktikum',
        description: 'Membuat skema 3NF dan diagram relasi',
        deadline: null,
        status: 'belum-selesai',
      }),
      Object.freeze<Task>({
        id: 2,
        title: 'Esai Etika Profesi',
        course: 'Etika TI',
        deadline: '2026-12-01',
        status: 'selesai',
      }),
      Object.freeze<Task>({
        id: 3,
        title: 'Implementasi Router',
        course: 'PAW',
        category: 'Proyek',
        description: 'Nested routes dengan fallback Nginx',
        deadline: null,
        status: 'belum-selesai',
      }),
    ]);

  it('menormalkan query kosong, spasi tepi, spasi ganda, dan huruf besar', () => {
    assert.equal(normalizeSearchQuery(''), '');
    assert.equal(normalizeSearchQuery('   \t\n  '), '');
    assert.equal(normalizeSearchQuery('  Basis   Data  '), 'basis data');
  });

  it('query kosong atau hanya spasi cocok dengan seluruh tugas', () => {
    const source = richTasks();
    assert.equal(matchesSearchQuery(source[1] as Task, ''), true);
    assert.deepEqual(
      queryTasks(source, 'all', '   ').map((t) => t.id),
      [1, 2, 3],
    );
  });

  it('mencocokkan judul, mata kuliah, kategori, dan deskripsi secara case-insensitive serta aman tanpa field opsional', () => {
    const source = richTasks();
    assert.deepEqual(queryTasks(source, 'all', 'NORMALISASI').map((t) => t.id), [1]);
    assert.deepEqual(queryTasks(source, 'all', 'etika ti').map((t) => t.id), [2]);
    assert.deepEqual(queryTasks(source, 'all', 'PRAKTIKUM').map((t) => t.id), [1]);
    assert.deepEqual(queryTasks(source, 'all', 'nested   routes').map((t) => t.id), [3]);
    assert.deepEqual(queryTasks(source, 'all', 'tidak-ada'), []);
  });

  it('menggabungkan filter status dan query pencarian secara konsisten tanpa mengubah array sumber', () => {
    const source = richTasks();
    assert.deepEqual(queryTasks(source, 'active', 'proyek').map((t) => t.id), [3]);
    assert.deepEqual(queryTasks(source, 'completed', 'proyek'), []);
    assert.deepEqual(queryTasks(source, 'completed', 'etika').map((t) => t.id), [2]);
    assert.equal(source.length, 3);
  });
});
