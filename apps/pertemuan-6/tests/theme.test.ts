import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { otherTheme, resolveTheme, THEME_CANVAS } from '../src/theme.ts';

describe('resolveTheme', () => {
  it('memakai pilihan tersimpan yang valid', () => {
    assert.equal(resolveTheme('light', false), 'light');
    assert.equal(resolveTheme('dark', true), 'dark');
  });

  it('tanpa pilihan valid mengikuti sistem; bawaan gelap', () => {
    assert.equal(resolveTheme(null, true), 'light');
    assert.equal(resolveTheme(null, false), 'dark');
    assert.equal(resolveTheme('sepia', true), 'light');
    assert.equal(resolveTheme('', false), 'dark');
  });
});

describe('tema', () => {
  it('otherTheme membalik tema', () => {
    assert.equal(otherTheme('dark'), 'light');
    assert.equal(otherTheme('light'), 'dark');
  });

  it('canvas gelap sama dengan fallback Portal untuk Task 6', () => {
    assert.equal(THEME_CANVAS.dark, '#10110f');
    assert.match(THEME_CANVAS.light, /^#[0-9a-f]{6}$/);
  });
});
