#!/usr/bin/env node
/*
 * Builds the media for the works from the owner's local files (apps/pertemuan-7/local-media/, never committed).
 * Requires ffmpeg/ffprobe on PATH; no npm dependency.
 *
 *   node apps/pertemuan-7/tools/media.mjs            # stills + previews
 *   node apps/pertemuan-7/tools/media.mjs --stills   # only the committed stills
 *
 * Outputs
 *   public/works/<slug>/{cover,f1,f2,f3}.webp   small stills (committed): the four most detailed of 11 sampled
 *                                               moments (never a black frame); cover = most detailed, f1–f3 in time order
 *   local-media/previews/<slug>.mp4             6 s muted 720p loop (NOT committed; upload to the server by hand
 *                                               as /tugas/pertemuan-7/media/previews/<slug>.mp4)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const media = join(app, 'local-media');

/** slug → local source file. */
const WORKS = [
  { slug: 'last-friday-night', file: 'Last Friday Night [Mograph] ｜ Alight Motion (Free Preset) [X7lZLkjGXXk].webm' },
  { slug: 'a-signal-from-outer-space', file: 'LOUPE [F4D13E1].mp4' },
  { slug: 'love-letter-from-violet-evergarden', file: 'Love Letter From Violet Evergarden ¦ 君に世界 (1080p_30fps_H264-128kbit_AAC).mp4' },
  { slug: 'oregairu-cinta-terbaik', file: 'Oregairu [Edit⁄AMV] ¦ Cinta Terbaik (1080p_30fps_H264-128kbit_AAC).mp4' },
  { slug: 'sousou-no-frieren-new-tank', file: 'Sousou No Frieren Edit ｜ New Tank (free project file) [6ZdKTaC54z8].mkv' },
  { slug: 'ilusi-garis-kemiskinan', file: 'ILUSI GARIS KEMISKINAN.mp4' },
  { slug: 'rahmatan-lil-alamin', file: 'RLAA.mp4' },
  { slug: 'sundays', file: 'Sundays2.mp4' },
];

/** Candidate moments (fractions of the duration) scored for detail. */
const CANDIDATES = Array.from({ length: 11 }, (_, i) => 0.08 + (i * 0.84) / 10);
const PREVIEW_S = 6;
const onlyStills = process.argv.includes('--stills');

function duration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number.parseFloat(String(out));
}

function still(file, atS, out) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', atS.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=1280:-2', '-c:v', 'libwebp', '-quality', '78', out]);
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

for (const work of WORKS) {
  const source = join(media, work.file);
  if (!existsSync(source)) {
    console.warn(`skip ${work.slug}: missing ${work.file}`);
    continue;
  }
  const length = duration(source);
  const dir = join(app, 'public', 'works', work.slug);
  mkdirSync(dir, { recursive: true });
  const scored = CANDIDATES.map((at) => ({ at, score: detail(source, length * at) })).sort((a, b) => b.score - a.score);
  const [cover, ...rest] = scored;
  const frames = rest.slice(0, 3).sort((a, b) => a.at - b.at);
  still(source, length * cover.at, join(dir, 'cover.webp'));
  frames.forEach((frame, i) => still(source, length * frame.at, join(dir, `f${i + 1}.webp`)));
  if (!onlyStills) {
    mkdirSync(join(media, 'previews'), { recursive: true });
    // The preview loop starts at the cover moment, so the poster and the first frames match.
    const start = Math.max(0, Math.min(length * cover.at, length - PREVIEW_S));
    preview(source, start, join(media, 'previews', `${work.slug}.mp4`));
  }
  console.log(`ok ${work.slug} (${length.toFixed(1)} s)`);
}
