#!/usr/bin/env node
/*
 * Builds the media for the works. Requires ffmpeg/ffprobe on PATH; no npm dependency.
 *
 *   node apps/pertemuan-7/tools/media.mjs                  # covers + styleframes + preview loops
 *   node apps/pertemuan-7/tools/media.mjs --stills         # covers + styleframes only (what gets committed)
 *   node apps/pertemuan-7/tools/media.mjs --covers         # only the YouTube thumbnails (no local video needed)
 *   node apps/pertemuan-7/tools/media.mjs --only sundays   # one work (combine with the flags above)
 *
 * Cover (public/works/<slug>/cover.webp, committed)
 *   Works on YouTube use their YouTube thumbnail (maxres → sd → hq). The others use the frame at `cover`, or the
 *   most detailed of 11 sampled moments when `cover` is empty.
 *
 * Styleframes (public/works/<slug>/f1.webp … fN.webp, committed; shown on the work page and in the player scrubber)
 *   1. Own images in local-media/frames/<slug>/ (png, jpg or webp, sorted by name) win when present.
 *   2. Otherwise `frames: ['0:12.5', '1:05', '2:40']` grabs exactly those moments (any count).
 *   3. Otherwise the three most detailed sampled moments, in time order (never a black frame).
 *   When the count is not 3, set the same count in src/data/works.ts (`{ frames: n }`).
 *
 * Preview loop (local-media/previews/<slug>.mp4, NOT committed; upload by hand to
 *   <webroot>/tugas/pertemuan-7/media/previews/<slug>.mp4): 6 s, muted, 720p, starting at the first styleframe.
 *
 * Source videos live in apps/pertemuan-7/local-media/ (excluded from git). YouTube ids mirror src/data/works.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTimestamp } from './timestamp.mjs';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const media = join(app, 'local-media');

/**
 * slug → local source file, YouTube id, and optional hand-picked moments.
 * @type {Array<{ slug: string, file: string, youtube?: string, cover?: string, frames?: string[] }>}
 */
const WORKS = [
  { slug: 'last-friday-night', file: 'Last Friday Night [Mograph] ｜ Alight Motion (Free Preset) [X7lZLkjGXXk].webm', youtube: 'X7lZLkjGXXk' },
  { slug: 'a-signal-from-outer-space', file: 'LOUPE [F4D13E1].mp4', youtube: 'talzLiLx1fc' },
  { slug: 'love-letter-from-violet-evergarden', file: 'Love Letter From Violet Evergarden ¦ 君に世界 (1080p_30fps_H264-128kbit_AAC).mp4', youtube: 'SVuNZH-vqMg' },
  { slug: 'oregairu-cinta-terbaik', file: 'Oregairu [Edit⁄AMV] ¦ Cinta Terbaik (1080p_30fps_H264-128kbit_AAC).mp4', youtube: 'qYnPTRtK7Xk' },
  { slug: 'sousou-no-frieren-new-tank', file: 'Sousou No Frieren Edit ｜ New Tank (free project file) [6ZdKTaC54z8].mkv', youtube: '6ZdKTaC54z8' },
  { slug: 'ilusi-garis-kemiskinan', file: 'ILUSI GARIS KEMISKINAN.mp4' },
  { slug: 'rahmatan-lil-alamin', file: 'RLAA.mp4' },
  { slug: 'sundays', file: 'Sundays2.mp4' },
];

/** Candidate moments (fractions of the duration) scored for detail. */
const CANDIDATES = Array.from({ length: 11 }, (_, i) => 0.08 + (i * 0.84) / 10);
const AUTO_FRAMES = 3;
const PREVIEW_S = 6;
const STILL_FILTER = 'scale=1280:-2';
const OWN_FRAME = /\.(png|jpe?g|webp)$/i;
const THUMBNAILS = ['maxresdefault', 'sddefault', 'hqdefault'];

const args = process.argv.slice(2);
const onlyCovers = args.includes('--covers');
const onlyStills = args.includes('--stills');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
if (onlyIndex >= 0 && !WORKS.some((work) => work.slug === only)) {
  console.error(`unknown slug for --only: ${only ?? '(missing)'}`);
  process.exit(1);
}

function duration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number.parseFloat(String(out));
}

/** One frame of a video (`atS` seconds in), or a still image, as a 1280-wide webp. */
function still(file, atS, out, filter = STILL_FILTER) {
  const seek = atS === null ? [] : ['-ss', atS.toFixed(2)];
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...seek, '-i', file, '-frames:v', '1', '-vf', filter, '-c:v', 'libwebp', '-quality', '78', out]);
}

/** Luma standard deviation of a tiny grey thumbnail: 0 for a flat (black) frame, high for a detailed one. */
function detail(file, atS) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', atS.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=48:27,format=gray', '-f', 'rawvideo', '-']);
  if (raw.length === 0) return 0;
  let sum = 0;
  for (const v of raw) sum += v;
  const mean = sum / raw.length;
  let variance = 0;
  for (const v of raw) variance += (v - mean) ** 2;
  return Math.sqrt(variance / raw.length);
}

function preview(file, atS, out) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', atS.toFixed(2), '-t', String(PREVIEW_S), '-i', file,
    '-an', '-vf', 'scale=-2:720,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ]);
}

/** Downloads the best YouTube thumbnail that exists and writes it as the cover. */
async function youtubeCover(id, out) {
  for (const name of THUMBNAILS) {
    const response = await fetch(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/${name}.jpg`);
    if (!response.ok) continue;
    const tmp = join(tmpdir(), `yt-${id}-${name}.jpg`);
    writeFileSync(tmp, Buffer.from(await response.arrayBuffer()));
    try {
      // sd/hq thumbnails are 4:3 canvases with the 16:9 picture letterboxed inside: crop the bars away.
      still(tmp, null, out, name === 'maxresdefault' ? STILL_FILTER : `crop=iw:trunc(iw*9/32)*2,${STILL_FILTER}`);
    } finally {
      rmSync(tmp, { force: true });
    }
    return name;
  }
  throw new Error(`no YouTube thumbnail for ${id}`);
}

/** Removes f<n>.webp files beyond `count`, so a shorter frame list leaves no stale frames behind. */
function pruneFrames(dir, count) {
  for (const name of readdirSync(dir)) {
    const match = /^f(\d+)\.webp$/.exec(name);
    if (match && Number(match[1]) > count) rmSync(join(dir, name));
  }
}

for (const work of WORKS) {
  if (only && work.slug !== only) continue;
  const dir = join(app, 'public', 'works', work.slug);
  mkdirSync(dir, { recursive: true });
  const done = [];

  if (work.youtube) done.push(`cover ← youtube ${await youtubeCover(work.youtube, join(dir, 'cover.webp'))}`);
  if (onlyCovers) {
    if (done.length) console.log(`ok ${work.slug}: ${done.join(', ')}`);
    continue;
  }

  const ownDir = join(media, 'frames', work.slug);
  const own = existsSync(ownDir) ? readdirSync(ownDir).filter((name) => OWN_FRAME.test(name)).sort() : [];
  const source = join(media, work.file);
  const hasSource = existsSync(source);
  const length = hasSource ? duration(source) : 0;
  const scored = hasSource ? CANDIDATES.map((at) => ({ at: length * at, score: detail(source, length * at) })).sort((a, b) => b.score - a.score) : [];

  // Cover for works not on YouTube.
  if (!work.youtube) {
    if (!hasSource) {
      console.warn(`skip ${work.slug}: missing ${work.file}`);
      continue;
    }
    const at = work.cover ? parseTimestamp(work.cover) : scored[0].at;
    still(source, at, join(dir, 'cover.webp'));
    done.push(`cover @ ${at.toFixed(1)} s`);
  }

  // Styleframes.
  let firstFrameAt = scored[0]?.at ?? 0;
  if (own.length) {
    own.forEach((name, i) => still(join(ownDir, name), null, join(dir, `f${i + 1}.webp`)));
    pruneFrames(dir, own.length);
    done.push(`${own.length} own frames`);
  } else if (!hasSource) {
    console.warn(`skip ${work.slug} styleframes: missing ${work.file} (and no local-media/frames/${work.slug}/)`);
  } else {
    // Auto mode skips the most detailed moment when it already became the cover.
    const skip = work.youtube || work.cover ? 0 : 1;
    const moments = work.frames?.length
      ? work.frames.map(parseTimestamp)
      : scored.slice(skip, skip + AUTO_FRAMES).map((s) => s.at).sort((a, b) => a - b);
    for (const at of moments) if (at > length) throw new Error(`${work.slug}: ${at} s is past the end (${length.toFixed(1)} s)`);
    moments.forEach((at, i) => still(source, at, join(dir, `f${i + 1}.webp`)));
    pruneFrames(dir, moments.length);
    firstFrameAt = moments[0];
    done.push(`${moments.length} frames @ ${moments.map((at) => at.toFixed(1)).join(', ')} s`);
  }

  if (!onlyStills && hasSource) {
    mkdirSync(join(media, 'previews'), { recursive: true });
    const start = Math.max(0, Math.min(firstFrameAt, length - PREVIEW_S));
    preview(source, start, join(media, 'previews', `${work.slug}.mp4`));
    done.push('preview');
  }
  console.log(`ok ${work.slug}: ${done.join(', ')}`);
}
