#!/usr/bin/env node
/*
 * Nulis favicon buat semua halaman.
 *
 *   Semua selain Task 7 pakai ikon halaman utama: "F" monospace hijau tebal, SVG yang sama dengan yang
 *   di-inline src/layouts/BaseLayout.astro.
 *     public/favicon.svg, public/favicon.ico   situs root (halaman daftar task link ke sini; /favicon.ico juga jadi
 *                                              fallback browser buat halaman tanpa ikon sendiri)
 *     <link rel="icon"> data URI               Task 1, Task 6 (app + halaman docs), Task 8
 *   Task 7 pakai logo sendiri: "F" tanda tangan dengan pengaturan pena yang sama dengan logo di halaman
 *   (apps/pertemuan-7/src/components/LogoMark.tsx, path di apps/pertemuan-7/src/logo/signature.ts).
 *
 *   npm run favicons      (butuh ImageMagick `magick` di PATH buat bikin .ico)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signatureSvg } from '../apps/pertemuan-7/src/logo/signature.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Ikon halaman utama, identik dengan yang ada di src/layouts/BaseLayout.astro. */
const homeSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<text x='50' y='50' text-anchor='middle' dominant-baseline='central' font-size='80' font-family='monospace' font-weight='bold' fill='#40a02b'>F</text>" +
  '</svg>';

/** Task 7: logo di halaman (LogoMark: nib selebar 1.8, 7 langkah, stroke 1.1). */
const task7Svg = signatureSvg({ disc: '#fafafa', ink: '#0a0a0a', nibWidth: 1.8, nibSteps: 7, strokeWidth: 1.1 });

const dataUri = (svg) =>
  `data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}`;
const iconLink = (svg) => `<link rel="icon" type="image/svg+xml" href="${dataUri(svg)}" />`;

writeFileSync(join(root, 'public/favicon.svg'), `${homeSvg}\n`);

const tmp = mkdtempSync(join(tmpdir(), 'favicon-'));
try {
  const source = join(tmp, 'favicon.svg');
  writeFileSync(source, homeSvg);
  const sizes = [16, 32, 48].map((size) => {
    const png = join(tmp, `${size}.png`);
    execFileSync('magick', ['-background', 'none', '-density', '600', source, '-resize', `${size}x${size}`, png]);
    return png;
  });
  execFileSync('magick', [...sizes, join(root, 'public/favicon.ico')]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const pages = [
  ['apps/pertemuan-1/index.html', homeSvg],
  ['apps/pertemuan-6/index.html', homeSvg],
  ['apps/pertemuan-6/dokumentasi/index.html', homeSvg],
  ['apps/pertemuan-7/index.html', task7Svg],
  ['apps/pertemuan-8/index.html', homeSvg],
];
for (const [page, svg] of pages) {
  const file = join(root, page);
  const html = readFileSync(file, 'utf8');
  const link = iconLink(svg);
  // Ganti link ikon satu baris yang sudah ada (dengan atau tanpa slash penutup), kalau nggak ada tambahin satu setelah viewport.
  const existing = /^([ \t]*)<link rel="icon"[^\n]*>$/m;
  const next = existing.test(html)
    ? html.replace(existing, (_, indent) => `${indent}${link}`)
    : html.replace(/^([ \t]*)(<meta name="viewport"[^\n]*>)$/m, (_, indent, meta) => `${indent}${meta}\n${indent}${link}`);
  if (!next.includes(link)) throw new Error(`no place for the favicon in ${page}`);
  writeFileSync(file, next);
}

console.log('favicons written: public/favicon.svg, public/favicon.ico,', pages.map(([page]) => page).join(', '));
