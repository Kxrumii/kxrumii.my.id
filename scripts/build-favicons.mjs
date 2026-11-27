#!/usr/bin/env node
/*
 * Writes the signature "F" favicon everywhere it is used, from the same paths as the Task 7 logo
 * (apps/pertemuan-7/src/logo/signature.ts):
 *
 *   public/favicon.svg, public/favicon.ico   root site (Astro portal and task list)
 *   <link rel="icon"> data URI               Task 6 app + docs page, Task 7 app (works in each app's dev server
 *                                            and under its /tugas/... subpath in production)
 *
 *   npm run favicons      (needs ImageMagick `magick` on PATH for the .ico)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signatureSvg } from '../apps/pertemuan-7/src/logo/signature.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

// Slightly heavier ink than the on-page logo so the letter survives 16 px.
const svg = signatureSvg({ disc: '#fafafa', ink: '#0a0a0a', nibWidth: 2.6, nibSteps: 7, strokeWidth: 2.2 });
const dataUri = `data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}`;
const iconLink = `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`;

writeFileSync(join(root, 'public/favicon.svg'), `${svg}\n`);

const tmp = mkdtempSync(join(tmpdir(), 'favicon-'));
try {
  const source = join(tmp, 'favicon.svg');
  writeFileSync(source, svg);
  const sizes = [16, 32, 48].map((size) => {
    const png = join(tmp, `${size}.png`);
    execFileSync('magick', ['-background', 'none', '-density', '600', source, '-resize', `${size}x${size}`, png]);
    return png;
  });
  execFileSync('magick', [...sizes, join(root, 'public/favicon.ico')]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const pages = ['apps/pertemuan-6/index.html', 'apps/pertemuan-6/dokumentasi/index.html', 'apps/pertemuan-7/index.html'];
for (const page of pages) {
  const file = join(root, page);
  const html = readFileSync(file, 'utf8');
  const existing = /^([ \t]*)<link rel="icon"[^\n]*\/>$/m;
  const next = existing.test(html)
    ? html.replace(existing, (_, indent) => `${indent}${iconLink}`)
    : html.replace(/^([ \t]*)(<meta name="viewport"[^\n]*\/>)$/m, (_, indent, meta) => `${indent}${meta}\n${indent}${iconLink}`);
  if (next === html && !html.includes(iconLink)) throw new Error(`no place for the favicon in ${page}`);
  writeFileSync(file, next);
}

console.log('favicons written: public/favicon.svg, public/favicon.ico,', pages.join(', '));
