import assert from 'node:assert/strict';
import { test } from 'node:test';
import { works } from '../src/data/works.ts';
import type { Work } from '../src/types.ts';
import { interleave } from '../src/utils/interleave.ts';
import { coverImage, coverPalette, findWork, nextWork, workNumber } from '../src/utils/works.ts';

const make = (slug: string, extra: Partial<Work> = {}): Work => ({
  slug,
  title: slug,
  year: null,
  category: 'film',
  role: null,
  summary: '',
  notes: null,
  thumbnail: null,
  youtubeVideoId: null,
  externalUrl: null,
  isSample: true,
  ...extra,
});

test('work data: unique, URL-safe slugs and no invented details', () => {
  const slugs = works.map((work) => work.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const work of works) {
    assert.match(work.slug, /^[a-z0-9-]+$/);
    if (work.isSample) {
      assert.equal(work.year, null, `${work.slug}: sample entries must not carry a year`);
      assert.equal(work.role, null, `${work.slug}: sample entries must not carry a role`);
    }
  }
});

test('work numbers are two digits from 01', () => {
  assert.equal(workNumber(0), '01');
  assert.equal(workNumber(11), '12');
});

test('findWork and nextWork resolve slugs and wrap around', () => {
  const list = [make('a'), make('b'), make('c')];
  assert.equal(findWork(list, 'b')?.slug, 'b');
  assert.equal(findWork(list, 'zzz'), null);
  assert.equal(findWork(list, undefined), null);
  assert.equal(nextWork(list, 'a')?.slug, 'b');
  assert.equal(nextWork(list, 'c')?.slug, 'a');
  assert.equal(nextWork(list, 'zzz'), null);
  assert.equal(nextWork([make('only')], 'only'), null);
});

test('covers: own thumbnail first, then the YouTube still, else generative', () => {
  assert.equal(coverImage(make('x', { thumbnail: '/a.jpg', youtubeVideoId: 'abc' })), '/a.jpg');
  assert.equal(coverImage(make('x', { youtubeVideoId: 'abc' })), 'https://i.ytimg.com/vi/abc/hqdefault.jpg');
  assert.equal(coverImage(make('x')), null);
});

test('generative cover palettes are deterministic per slug', () => {
  assert.deepEqual(coverPalette('sample-work-03'), coverPalette('sample-work-03'));
  const palette = coverPalette('anything');
  assert.match(palette.from, /^#[0-9a-f]{6}$/);
  assert.ok(palette.angle >= 100 && palette.angle < 240);
});

test('interleave keeps every word in order and spreads images between them', () => {
  const text = 'one two three four five six seven eight';
  const pieces = interleave(text, 3);
  const words = pieces.filter((p) => p.kind === 'word').map((p) => (p.kind === 'word' ? p.text : ''));
  assert.deepEqual(words, text.split(' '));
  const images = pieces.filter((p) => p.kind === 'image');
  assert.equal(images.length, 3);
  assert.equal(pieces[0].kind, 'word');
  assert.equal(pieces[pieces.length - 1].kind, 'word');
  // Never two images side by side.
  for (let i = 1; i < pieces.length; i += 1) assert.ok(!(pieces[i].kind === 'image' && pieces[i - 1].kind === 'image'));
});

test('interleave caps images to the gaps that exist', () => {
  assert.equal(interleave('a b', 5).filter((p) => p.kind === 'image').length, 1);
  assert.equal(interleave('solo', 3).filter((p) => p.kind === 'image').length, 0);
  assert.deepEqual(interleave('', 2), []);
});
