import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORBIT_LIMIT,
  ORBIT_REFLOW_POS_EPSILON,
  ORBIT_REFLOW_SCALE_EPSILON,
  computeOrbitalPositions,
  paginateOrbit,
  resolveEffectiveView,
  shouldIdleDrift,
  stepOrbitalCoord,
  type BoxMeasure,
  type OrbitalCoord,
  type OrbitalDriftState,
} from '../src/orbital-stage.ts';

describe('resolveEffectiveView', () => {
  it('auto memilih orbit sampai 12 tugas tampak dan list di atas 12', () => {
    assert.equal(resolveEffectiveView(0, 'auto'), 'orbit');
    assert.equal(resolveEffectiveView(1, 'auto'), 'orbit');
    assert.equal(resolveEffectiveView(ORBIT_LIMIT, 'auto'), 'orbit');
    assert.equal(resolveEffectiveView(ORBIT_LIMIT + 1, 'auto'), 'list');
  });

  it('pilihan eksplisit orbit atau list selalu dihormati', () => {
    assert.equal(resolveEffectiveView(25, 'orbit'), 'orbit');
    assert.equal(resolveEffectiveView(3, 'list'), 'list');
  });

  it('pattern A: pilihan eksplisit orbit dengan > 12 tugas tetap di orbit dan terpaginasi tepat 12 per halaman', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => i + 1);
    assert.equal(resolveEffectiveView(thirty.length, 'orbit'), 'orbit');
    const p1 = paginateOrbit(thirty, 1, ORBIT_LIMIT);
    const p2 = paginateOrbit(thirty, 2, ORBIT_LIMIT);
    const p3 = paginateOrbit(thirty, 3, ORBIT_LIMIT);
    assert.equal(p1.totalPages, 3);
    assert.equal(p1.items.length, 12);
    assert.equal(p2.items.length, 12);
    assert.equal(p3.items.length, 6);
    assert.equal(p3.startIndex, 25);
    assert.equal(p3.endIndex, 30);
  });
});

describe('paginateOrbit', () => {
  it('menangani daftar kosong dan daftar <= 12 item', () => {
    assert.deepEqual(paginateOrbit([], 1), {
      items: [],
      page: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    });
    const eight = [1, 2, 3, 4, 5, 6, 7, 8];
    assert.deepEqual(paginateOrbit(eight, 1), {
      items: eight,
      page: 1,
      totalPages: 1,
      startIndex: 1,
      endIndex: 8,
    });
  });

  it('membagi 13 item menjadi halaman 1 (1..12) dan halaman 2 (13..13) serta mengekang halaman di luar rentang', () => {
    const items = Array.from({ length: 13 }, (_, i) => i + 1);
    const p1 = paginateOrbit(items, 1);
    assert.equal(p1.page, 1);
    assert.equal(p1.totalPages, 2);
    assert.equal(p1.startIndex, 1);
    assert.equal(p1.endIndex, 12);
    assert.equal(p1.items.length, 12);

    const p2 = paginateOrbit(items, 2);
    assert.equal(p2.page, 2);
    assert.equal(p2.startIndex, 13);
    assert.equal(p2.endIndex, 13);
    assert.deepEqual(p2.items, [13]);

    assert.equal(paginateOrbit(items, 99).page, 2);
    assert.equal(paginateOrbit(items, -3).page, 1);
  });
});

describe('computeOrbitalPositions', () => {
  const sampleMeasures = (n: number): BoxMeasure[] =>
    Array.from({ length: n }, () => ({
      width: 160,
      height: 190,
      captionWidth: 130,
      captionHeight: 24,
    }));

  it('mengembalikan array kosong untuk 0 tugas atau ukuran panggung non-positif', () => {
    assert.deepEqual(computeOrbitalPositions(0, 1200, 600, [], -0.82, 0), []);
    assert.deepEqual(computeOrbitalPositions(3, 0, 600, sampleMeasures(3), -0.82, 0), []);
  });

  it('menjaga 1, 2, 3, 8, dan 12 kotak serta keterangannya tetap di dalam batas panggung', () => {
    for (const [w, h] of [
      [1440, 700],
      [390, 560],
      [320, 400],
    ]) {
      for (const n of [1, 2, 3, 8, 12]) {
        const placements = computeOrbitalPositions(n, w, h, sampleMeasures(n), -0.82, 0.25);
        assert.equal(placements.length, n);
        for (const p of placements) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(p.scale >= 0.72 && p.scale <= 1.1);
          assert.ok(p.captionX >= 8 && p.captionX <= Math.max(8, w - 130 - 8));
          assert.ok(p.captionY >= 8 && p.captionY <= Math.max(8, h - 24 - 8));
        }
      }
    }
  });
});

describe('shouldIdleDrift', () => {
  const baseState = (): OrbitalDriftState => ({
    active: true,
    count: 5,
    manualPaused: false,
    dragging: false,
    reducedMotion: false,
    documentHidden: false,
    dialogOpen: false,
    keyboardFocused: false,
    routeTransitionActive: false,
  });

  it('tetap berjalan pada kondisi normal (hover tidak menghentikan animasi)', () => {
    assert.equal(shouldIdleDrift(baseState()), true);
  });

  it('berhenti bila tidak aktif atau tugas <= 1', () => {
    assert.equal(shouldIdleDrift({ ...baseState(), active: false }), false);
    assert.equal(shouldIdleDrift({ ...baseState(), count: 0 }), false);
    assert.equal(shouldIdleDrift({ ...baseState(), count: 1 }), false);
  });

  it('mempertahankan seluruh kondisi jeda yang disyaratkan', () => {
    const pauseKeys: (keyof OrbitalDriftState)[] = [
      'manualPaused',
      'dragging',
      'reducedMotion',
      'documentHidden',
      'dialogOpen',
      'keyboardFocused',
      'routeTransitionActive',
    ];
    for (const key of pauseKeys) {
      assert.equal(shouldIdleDrift({ ...baseState(), [key]: true }), false, `expected pause when ${key}=true`);
    }
  });
});

describe('stepOrbitalCoord (CP1-D orbit layout reflow)', () => {
  it('menginterpolasi koordinat secara bertahap menuju target dan snap persis saat konvergen', () => {
    let coord: OrbitalCoord = { x: -120, y: 40, scale: 0.78, captionX: 20, captionY: 220 };
    const target: OrbitalCoord = { x: 80, y: -15, scale: 1.02, captionX: 410, captionY: 310 };

    // dtMs <= 0 aman dan tidak melompat
    const zeroStep = stepOrbitalCoord(coord, target, 0);
    assert.equal(zeroStep.settled, false);
    assert.deepEqual(zeroStep.coord, coord);

    let frames = 0;
    let settled = false;
    while (!settled && frames < 120) {
      const prevDist = Math.hypot(target.x - coord.x, target.y - coord.y);
      const step = stepOrbitalCoord(coord, target, 16);
      coord = step.coord;
      settled = step.settled;
      const nextDist = Math.hypot(target.x - coord.x, target.y - coord.y);
      assert.ok(nextDist <= prevDist);
      frames += 1;
    }

    assert.equal(settled, true);
    assert.ok(frames < 60);
    assert.deepEqual(coord, target);
  });

  it('langsung snap ke target jika selisih sudah di bawah ambang konvergensi', () => {
    const target: OrbitalCoord = { x: 10, y: 20, scale: 1, captionX: 100, captionY: 200 };
    const near: OrbitalCoord = {
      x: target.x + ORBIT_REFLOW_POS_EPSILON * 0.5,
      y: target.y - ORBIT_REFLOW_POS_EPSILON * 0.5,
      scale: target.scale + ORBIT_REFLOW_SCALE_EPSILON * 0.4,
      captionX: target.captionX + ORBIT_REFLOW_POS_EPSILON * 0.5,
      captionY: target.captionY,
    };
    const res = stepOrbitalCoord(near, target, 16);
    assert.equal(res.settled, true);
    assert.deepEqual(res.coord, target);
  });
});
