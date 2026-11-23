import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeLoad,
  describeSaveFailure,
  isTask,
  loadTasks,
  saveTasks,
  STORAGE_KEY,
  STORAGE_VERSION,
  type StorageLike,
} from '../src/storage.ts';
import type { Task } from '../src/types.ts';

function memoryStorage(initial?: string): StorageLike & { data: Map<string, string>; writes: number } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  const storage = {
    data,
    writes: 0,
    getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) {
      storage.writes += 1;
      data.set(key, value);
    },
  };
  return storage;
}

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Laporan',
  course: 'Basis Data',
  deadline: '2026-12-12',
  status: 'belum-selesai',
  ...overrides,
});
const envelope = (tasks: unknown, version: unknown = STORAGE_VERSION) => JSON.stringify({ version, tasks });

describe('loadTasks — kondisi dasar', () => {
  it('kunci tidak ada → daftar kosong tanpa masalah', () => {
    assert.deepEqual(loadTasks(memoryStorage()), { tasks: [], skipped: 0, issue: null });
  });

  it('envelope valid dipulihkan lengkap dengan nilai dan status, termasuk deadline null', () => {
    const stored = [task(), task({ id: 7, title: 'Resume', deadline: null, status: 'selesai' })];
    const result = loadTasks(memoryStorage(envelope(stored)));
    assert.equal(result.issue, null);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.tasks, stored);
  });

  it('JSON rusak ditolak dan tidak menulis ke storage', () => {
    const storage = memoryStorage('{oops');
    assert.deepEqual(loadTasks(storage), { tasks: [], skipped: 0, issue: 'invalid-data' });
    assert.equal(storage.writes, 0);
    assert.equal(storage.data.get(STORAGE_KEY), '{oops');
  });

  it('struktur envelope salah ditolak', () => {
    for (const raw of ['[]', 'null', '42', '"x"', '{}', JSON.stringify({ version: 1 }), JSON.stringify({ tasks: [] }), JSON.stringify({ version: '1', tasks: [] }), JSON.stringify({ version: 1, tasks: {} })]) {
      assert.equal(loadTasks(memoryStorage(raw)).issue, 'invalid-data', raw);
    }
  });

  it('versi tidak didukung tidak dipercaya', () => {
    const result = loadTasks(memoryStorage(envelope([task()], 2)));
    assert.deepEqual(result, { tasks: [], skipped: 0, issue: 'unsupported-version' });
  });
});

describe('loadTasks — validasi record', () => {
  const rejected: Array<[string, Record<string, unknown>]> = [
    ['id nol', { id: 0 }],
    ['id negatif', { id: -3 }],
    ['id pecahan', { id: 1.5 }],
    ['id string', { id: '1' }],
    ['id tidak aman', { id: Number.MAX_SAFE_INTEGER + 2 }],
    ['judul kosong', { title: '' }],
    ['judul hanya spasi', { title: '   ' }],
    ['judul bukan string', { title: 5 }],
    ['mata kuliah kosong', { course: '' }],
    ['mata kuliah hanya spasi', { course: ' \t' }],
    ['status asing', { status: 'done' }],
    ['status kosong', { status: '' }],
    ['status hilang', { status: undefined }],
    ['deadline tanggal tidak ada', { deadline: '2026-02-30' }],
    ['deadline format salah', { deadline: '12/12/2026' }],
    ['deadline bukan string', { deadline: 20261212 }],
    ['deadline hilang', { deadline: undefined }],
  ];
  for (const [name, override] of rejected) {
    it(`menolak record: ${name}`, () => {
      const result = loadTasks(memoryStorage(envelope([task(override)])));
      assert.deepEqual(result.tasks, []);
      assert.equal(result.skipped, 1);
      assert.equal(result.issue, null);
    });
  }

  it('record yang bukan objek ditolak', () => {
    const result = loadTasks(memoryStorage(envelope([null, 5, 'x', [], task()])));
    assert.equal(result.tasks.length, 1);
    assert.equal(result.skipped, 4);
  });

  it('id ganda: record pertama dipertahankan, sisanya dilewati', () => {
    const result = loadTasks(memoryStorage(envelope([task({ id: 3, title: 'Pertama' }), task({ id: 3, title: 'Kedua' })])));
    assert.deepEqual(result.tasks.map((t) => t.title), ['Pertama']);
    assert.equal(result.skipped, 1);
  });

  it('campuran valid/tidak valid mempertahankan yang valid dan melaporkan jumlah yang dilewati', () => {
    const result = loadTasks(memoryStorage(envelope([task({ id: 1 }), task({ id: 2, status: 'x' }), task({ id: 3, title: '' }), task({ id: 4 })])));
    assert.deepEqual(result.tasks.map((t) => t.id), [1, 4]);
    assert.equal(result.skipped, 2);
    assert.match(describeLoad(result) ?? '', /2 data tugas tidak valid/);
  });

  it('tidak membuat nilai pengganti dan membuang properti tambahan', () => {
    const result = loadTasks(memoryStorage(envelope([task({ extra: 'x', __proto__: { polluted: true } })])));
    assert.deepEqual(Object.keys(result.tasks[0] as Task).sort(), ['course', 'deadline', 'id', 'status', 'title']);
  });

  it('teks berbahaya dipulihkan sebagai string biasa', () => {
    const payload = '<img src=x onerror=alert(1)>';
    assert.equal(loadTasks(memoryStorage(envelope([task({ title: payload })]))).tasks[0]?.title, payload);
  });

  it('isTask menolak non-objek', () => {
    assert.equal(isTask(null), false);
    assert.equal(isTask(undefined), false);
    assert.equal(isTask(task()), true);
  });
});

describe('kegagalan storage', () => {
  it('storage null (tidak dapat diakses) → unavailable', () => {
    assert.deepEqual(loadTasks(null), { tasks: [], skipped: 0, issue: 'unavailable' });
    assert.deepEqual(saveTasks(null, []), { ok: false, reason: 'unavailable' });
  });

  it('getItem melempar error → unavailable, tidak crash', () => {
    const storage: StorageLike = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} };
    assert.deepEqual(loadTasks(storage), { tasks: [], skipped: 0, issue: 'unavailable' });
  });

  it('setItem melempar error → save-failed, tidak crash', () => {
    const storage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    assert.deepEqual(saveTasks(storage, [task() as Task]), { ok: false, reason: 'save-failed' });
  });

  it('pesan untuk pengguna membedakan tiap kondisi', () => {
    const messages = new Set([
      describeLoad({ tasks: [], skipped: 0, issue: 'unavailable' }),
      describeLoad({ tasks: [], skipped: 0, issue: 'invalid-data' }),
      describeLoad({ tasks: [], skipped: 0, issue: 'unsupported-version' }),
      describeSaveFailure('unavailable'),
      describeSaveFailure('save-failed'),
    ]);
    assert.equal(messages.size, 5);
    assert.equal(describeLoad({ tasks: [], skipped: 0, issue: null }), null);
  });
});

describe('saveTasks', () => {
  it('menulis ke kunci yang benar dengan envelope bernomor versi', () => {
    const storage = memoryStorage();
    const tasks = [task() as Task];
    assert.deepEqual(saveTasks(storage, tasks), { ok: true });
    assert.equal(STORAGE_KEY, 'kxrumii:pertemuan-6:tasks:v1');
    assert.deepEqual(JSON.parse(storage.data.get(STORAGE_KEY) ?? ''), { version: 1, tasks });
  });

  it('round-trip menyimpan lalu memuat menghasilkan data yang sama', () => {
    const storage = memoryStorage();
    const tasks: Task[] = [
      { id: 2, title: 'A', course: 'PAW', deadline: null, status: 'selesai' },
      { id: 5, title: 'B', course: 'SO', deadline: '2026-12-31', status: 'belum-selesai' },
    ];
    saveTasks(storage, tasks);
    assert.deepEqual(loadTasks(storage), { tasks, skipped: 0, issue: null });
  });

  it('menyimpan daftar kosong setelah semua tugas dihapus', () => {
    const storage = memoryStorage(envelope([task()]));
    saveTasks(storage, []);
    assert.deepEqual(loadTasks(storage).tasks, []);
  });
});
