import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashTaskId,
  resolveBoxArchetype,
  resolveBoxProportion,
  resolveBoxVisual,
  resolveFallbackSurface,
  resolveSolidTone,
  resolveTexturePattern,
  splitTitleLines,
} from '../src/archetypes.ts';
import type { Task } from '../src/types.ts';

describe('hashTaskId dan stabilitas deterministik', () => {
  it('menghasilkan gaya latar hanya solid atau texture secara deterministik', () => {
    const seen = new Set<string>();
    for (let id = 1; id <= 200; id += 1) {
      const surface = resolveFallbackSurface(id);
      assert.ok(surface === 'solid' || surface === 'texture', `unexpected surface: ${String(surface)}`);
      seen.add(surface);
      assert.equal(resolveFallbackSurface(id), surface);
      assert.equal(hashTaskId(id), hashTaskId(id));
    }
    assert.deepEqual([...seen].sort(), ['solid', 'texture']);
  });

  it('komposisi kotak tetap stabil meski status atau tenggat berubah (kecuali urgensi solid)', () => {
    const base: Task = {
      id: 7,
      title: 'Normalisasi Basis Data',
      course: 'Basis Data',
      deadline: '2026-12-01',
      status: 'belum-selesai',
    };
    const first = resolveBoxVisual(base, 'upcoming');
    const toggled = resolveBoxVisual({ ...base, status: 'selesai' }, 'none');
    assert.equal(first.surface, toggled.surface);
    assert.equal(first.texture, toggled.texture);
    assert.equal(first.proportion, toggled.proportion);
    assert.deepEqual(first.lines, toggled.lines);
  });

  it('mendistribusikan berbagai arketipe, tekstur, dan proporsi di rentang 1..12', () => {
    const archetypes = new Set<string>();
    const proportions = new Set<string>();
    const textures = new Set<string>();
    const tones = new Set<string>();

    const titles = [
      'Redesign',
      'Struktur Graf & Tree',
      'Normalisasi basis data relasional',
      'Integral Lipat Tiga',
      'Wireframe Mobile',
      'Audit Rubrik PAW',
      'Routing / Subnetting',
      'Laporan Praktikum',
      'Catatan Desain Editorial',
      'Presentasi Akhir',
      'Evaluasi Heuristik',
      'Skema Indeks',
    ];

    titles.forEach((title, idx) => {
      const id = idx + 1;
      const task: Task = { id, title, course: 'MK', deadline: null, status: 'belum-selesai' };
      const visual = resolveBoxVisual(task, idx === 4 ? 'overdue' : 'upcoming');
      archetypes.add(visual.archetype);
      proportions.add(visual.proportion);
      textures.add(resolveTexturePattern(id));
      tones.add(resolveSolidTone(id, visual.archetype, 'upcoming'));
    });

    assert.ok(archetypes.size >= 4, `expected varied archetypes, got ${archetypes.size}`);
    assert.ok(proportions.size >= 2, `expected varied proportions, got ${proportions.size}`);
    assert.equal(textures.size, 3);
    assert.ok(tones.size >= 3);
  });

  it('judul dengan tanda hubung/penghubung (& atau /) memakai mono-hybrid', () => {
    const arch = resolveBoxArchetype({ id: 4, title: 'Routing & Subnetting' }, 'upcoming');
    assert.equal(arch, 'mono-hybrid');
  });

  it('mengembalikan proporsi yang valid untuk semua arketipe', () => {
    for (const arch of ['serif-split', 'grotesk-block', 'mixed-editorial', 'scale-italic', 'mono-hybrid', 'condensed-poster'] as const) {
      const p = resolveBoxProportion(arch, 3);
      assert.ok(p === 'portrait' || p === 'landscape' || p === 'tall');
    }
  });
});

describe('splitTitleLines', () => {
  it('memecah 1 kata, 2 kata, 3+ kata, dan kata panjang tanpa gagal', () => {
    assert.deepEqual(splitTitleLines('  Kalkulus  '), ['Kalkulus']);
    assert.deepEqual(splitTitleLines('Redesign Task'), ['Redesign', 'Task']);
    assert.deepEqual(splitTitleLines('Body Object Space'), ['Body', 'Object', 'Space']);

    const lines = splitTitleLines('Implementasi Antarmuka Orbital Untuk Koleksi Tugas Kuliah');
    assert.ok(lines.length >= 2 && lines.length <= 3);

    const longWord = 'A'.repeat(200);
    assert.deepEqual(splitTitleLines(longWord), [longWord]);
  });
});
