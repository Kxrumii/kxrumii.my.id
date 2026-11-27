/**
 * Verifies the shared transition bootstrap in the built site (run after `npm run build`).
 *
 * - The eight application documents contain exactly one bootstrap script.
 * - Its text is identical to packages/transition-bridge/src/bootstrap.inline.js.
 * - It follows <meta charset> and precedes the first stylesheet, <style> and module script.
 * - Static redirect documents are byte-identical to their source and carry no bootstrap.
 * - No other generated HTML document contains the bootstrap.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const MARKER = 'data-transition-bootstrap="v4"';
const SOURCE = readFileSync(
  join(root, 'packages/transition-bridge/src/bootstrap.inline.js'),
  'utf8',
).trim();

const APPLICATION_DOCUMENTS = [
  'index.html',
  'tugas/index.html',
  'tugas/pertemuan-1/index.html',
  'tugas/pertemuan-6/index.html',
  'tugas/pertemuan-6/dokumentasi/index.html',
  'tugas/pertemuan-7/index.html',
  'tugas/pertemuan-8/index.html',
];

const STATIC_REDIRECTS = [{ built: 'profil/index.html', source: 'public/profil/index.html' }];

const BOOTSTRAP_PATTERN = /<script\b[^>]*data-transition-bootstrap="v4"[^>]*>([\s\S]*?)<\/script>/gi;
const MUST_FOLLOW = { '<meta charset>': /<meta\s+charset\b/i };
const MUST_PRECEDE = {
  'stylesheet link': /<link\b[^>]*\brel\s*=\s*["']?stylesheet\b/i,
  '<style> element': /<style\b/i,
  'module script': /<script\b[^>]*\btype\s*=\s*["']?module\b/i,
};

const failures = [];
const fail = (file, message) => failures.push(`${file}: ${message}`);

function firstIndex(html, pattern) {
  const match = pattern.exec(html);
  return match ? match.index : -1;
}

function listHtml(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listHtml(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

for (const document of APPLICATION_DOCUMENTS) {
  const path = join(dist, document);
  if (!existsSync(path)) {
    fail(document, 'missing application document');
    continue;
  }

  const html = readFileSync(path, 'utf8');
  const scripts = [...html.matchAll(BOOTSTRAP_PATTERN)];
  if (scripts.length !== 1) {
    fail(document, `expected exactly 1 bootstrap script, found ${scripts.length}`);
    continue;
  }

  const [script] = scripts;
  if (script[1].trim() !== SOURCE) {
    fail(document, 'bootstrap text differs from packages/transition-bridge/src/bootstrap.inline.js');
  }

  for (const [label, pattern] of Object.entries(MUST_FOLLOW)) {
    const index = firstIndex(html, pattern);
    if (index === -1 || index > script.index) fail(document, `bootstrap must follow ${label}`);
  }

  for (const [label, pattern] of Object.entries(MUST_PRECEDE)) {
    const index = firstIndex(html, pattern);
    if (index !== -1 && index < script.index) fail(document, `bootstrap must precede the first ${label}`);
  }
}

for (const { built, source } of STATIC_REDIRECTS) {
  const builtPath = join(dist, built);
  if (!existsSync(builtPath)) {
    fail(built, 'missing static redirect document');
    continue;
  }
  const builtBytes = readFileSync(builtPath);
  if (!builtBytes.equals(readFileSync(join(root, source)))) {
    fail(built, `differs from ${source}`);
  }
  if (builtBytes.toString('utf8').includes(MARKER)) fail(built, 'must not contain the bootstrap');
}

// The bridge reads timing variables with parseFloat as milliseconds. A unit
// (for example `.52s` produced by CSS minification) would silently break motion.
const TIMING_VARIABLE = /(--transition-(?:exit-duration|enter-duration|exit-delay|enter-delay|stagger|canvas-delay|canvas-duration|exit-fallback-ms))\s*:\s*([^;}]*)/g;
function listFiles(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}
for (const path of [...listFiles(dist, '.css'), ...listHtml(dist)]) {
  const text = readFileSync(path, 'utf8');
  for (const [, name, value] of text.matchAll(TIMING_VARIABLE)) {
    if (!/^-?\d*\.?\d+$/.test(value.trim())) {
      fail(relative(dist, path).split(sep).join('/'), `${name} must be unitless milliseconds, found "${value.trim()}"`);
    }
  }
}

const expected = new Set(APPLICATION_DOCUMENTS);
for (const path of listHtml(dist)) {
  const document = relative(dist, path).split(sep).join('/');
  if (expected.has(document)) continue;
  if (readFileSync(path, 'utf8').includes(MARKER)) {
    fail(document, 'unexpected bootstrap in a non-application document');
  }
}

if (failures.length) {
  console.error('Transition bootstrap verification failed:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

for (const document of APPLICATION_DOCUMENTS) console.log(`  ✓ ${document}`);
for (const { built } of STATIC_REDIRECTS) console.log(`  ✓ ${built} (unchanged redirect)`);
console.log(`Transition bootstrap verified in ${APPLICATION_DOCUMENTS.length} application documents.`);
