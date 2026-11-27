import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { categoryLabel, works } from '../src/data/works.ts';
import type { Work } from '../src/types.ts';
import { interleave } from '../src/utils/interleave.ts';
import { coverImage, coverPalette, findWork, nextWork, prevWork, workNumber } from '../src/utils/works.ts';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

const make = (slug: string, extra: Partial<Work> = {}): Work => ({
  slug,
  title: slug,
  year: null,
  category: null,
  role: null,
  summary: null,
  notes: null,
  cover: null,
  styleframes: [],
  aspect: 16 / 9,
  preview: false,
  youtubeVideoId: null,
  externalUrl: null,
  isSample: false,
  ...extra,
});

test('the eight works: unique URL-safe slugs, five on YouTube, three still waiting for a link', () => {
  assert.equal(works.length, 8);
  const slugs = works.map((work) => work.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const work of works) assert.match(work.slug, /^[a-z0-9-]+$/);
  const onYouTube = works.filter((work) => work.youtubeVideoId !== null);
  assert.equal(onYouTube.length, 5);
  for (const work of onYouTube) assert.match(work.youtubeVideoId!, /^[\w-]{11}$/);
  assert.deepEqual(
    works.filter((work) => work.youtubeVideoId === null).map((work) => work.title),
    ['ILUSI GARIS KEMISKINAN', 'Rahmatan Lil Alamin', 'Sundays'],
  );
});

test('every work has a category and a description; unknown years and roles stay null instead of guessed', () => {
  for (const work of works) {
    assert.ok(work.category, work.slug);
    assert.ok(work.summary && work.summary.length > 40, work.slug);
    assert.ok(work.year === null || (Number.isInteger(work.year) && work.year >= 2015 && work.year <= new Date().getFullYear()), work.slug);
    assert.ok(work.role === null || work.role.trim().length > 0, work.slug);
    assert.equal(work.isSample, false, work.slug);
  }
  assert.equal(categoryLabel(make('x')), '—');
  assert.equal(categoryLabel(make('x', { category: 'mograph' })), 'mograph');
  assert.equal(categoryLabel(make('x', { category: 'film' })), 'film');
});

test('every cover and styleframe file exists in public/', () => {
  for (const work of works) {
    for (const path of [work.cover, ...work.styleframes]) {
      assert.ok(path, work.slug);
      assert.ok(existsSync(publicDir + path), `${work.slug}: missing public/${path}`);
    }
    assert.ok(work.styleframes.length > 0, work.slug);
  }
});

test('work numbers are two digits from 01', () => {
  assert.equal(workNumber(0), '01');
  assert.equal(workNumber(11), '12');
});

test('findWork, nextWork and prevWork resolve slugs and wrap around', () => {
  const list = [make('a'), make('b'), make('c')];
  assert.equal(findWork(list, 'b')?.slug, 'b');
  assert.equal(findWork(list, 'zzz'), null);
  assert.equal(findWork(list, undefined), null);
  assert.equal(nextWork(list, 'c')?.slug, 'a');
  assert.equal(prevWork(list, 'a')?.slug, 'c');
  assert.equal(prevWork(list, 'b')?.slug, 'a');
  assert.equal(nextWork(list, 'zzz'), null);
  assert.equal(prevWork([make('only')], 'only'), null);
});

test('covers: own still first, then the YouTube still, else generative', () => {
  assert.equal(coverImage(make('x', { cover: 'works/x/cover.webp', youtubeVideoId: 'abc' })), '/works/x/cover.webp');
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
  assert.equal(pieces.filter((p) => p.kind === 'image').length, 3);
  assert.equal(pieces[0].kind, 'word');
  assert.equal(pieces[pieces.length - 1].kind, 'word');
  for (let i = 1; i < pieces.length; i += 1) assert.ok(!(pieces[i].kind === 'image' && pieces[i - 1].kind === 'image'));
});

test('interleave caps images to the gaps that exist', () => {
  assert.equal(interleave('a b', 5).filter((p) => p.kind === 'image').length, 1);
  assert.equal(interleave('solo', 3).filter((p) => p.kind === 'image').length, 0);
  assert.deepEqual(interleave('', 2), []);
});
