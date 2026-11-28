#!/usr/bin/env node
/*
 * Bikin media buat karya-karya. Butuh ffmpeg/ffprobe di PATH; tanpa dependency npm.
 *
 *   node apps/pertemuan-7/tools/media.mjs                  # cover + styleframe + loop preview
 *   node apps/pertemuan-7/tools/media.mjs --stills         # cover + styleframe aja (yang di-commit)
 *   node apps/pertemuan-7/tools/media.mjs --covers         # cuma thumbnail YouTube (nggak butuh video lokal)
 *   node apps/pertemuan-7/tools/media.mjs --only sundays   # satu karya (bisa digabung dengan flag di atas)
 *
 * Cover (public/works/<slug>/cover.webp, di-commit)
 *   Karya di YouTube pakai thumbnail YouTube-nya (maxres → sd → hq). Sisanya pakai frame di `cover`, atau
 *   dari 11 titik sampel yang paling detail kalau `cover` kosong.
 *
 * Styleframes (public/works/<slug>/f1.webp … fN.webp, di-commit; tampil di halaman karya dan scrubber player)
 *   1. Gambar sendiri di local-media/frames/<slug>/ (png, jpg, atau webp, urut nama) menang kalau ada.
 *   2. Kalau nggak ada, `frames: ['0:12.5', '1:05', '2:40']` ngambil persis momen itu (jumlah bebas).
 *   3. Kalau nggak, tiga momen sampel paling detail, urut waktu (nggak pernah frame hitam).
 *   4. Nggak ada video lokal tapi ada di YouTube: frame otomatis YouTube (hq1–hq3, sekitar 25/50/75 %), dicrop ke 16:9.
 *   Kalau jumlahnya bukan 3, set jumlah yang sama di src/data/works.ts (`{ frames: n }`).
 *   Karya dengan `crop: "w:h:x:y"` (mis. Sundays yang isinya kotak) di-crop dulu: cover, styleframe, dan preview-nya ikut.
 *
 * Loop preview (local-media/previews/<slug>.mp4, TIDAK di-commit; upload manual ke
 *   <webroot>/tugas/pertemuan-7/media/previews/<slug>.mp4): 6 detik, muted, 720p, mulai dari styleframe pertama.
 *
 * Video sumber ada di apps/pertemuan-7/local-media/ (di-exclude dari git). ID YouTube sama dengan src/data/works.ts.
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
 * slug → file sumber lokal, id YouTube, dan momen pilihan (opsional).
 * @type {Array<{ slug: string, file: string, youtube?: string, cover?: string, frames?: string[] }>}
 */
const WORKS = [
  { slug: 'last-friday-night', file: 'Last Friday Night [Mograph] ｜ Alight Motion (Free Preset) [X7lZLkjGXXk].webm', youtube: 'X7lZLkjGXXk' },
  { slug: 'a-signal-from-outer-space', file: 'LOUPE [F4D13E1].mp4', youtube: 'talzLiLx1fc' },
  { slug: 'love-letter-from-violet-evergarden', file: 'Love Letter From Violet Evergarden ¦ 君に世界 (1080p_30fps_H264-128kbit_AAC).mp4', youtube: 'SVuNZH-vqMg' },
  { slug: 'oregairu-cinta-terbaik', file: 'Oregairu [Edit⁄AMV] ¦ Cinta Terbaik (1080p_30fps_H264-128kbit_AAC).mp4', youtube: 'qYnPTRtK7Xk' },
  { slug: 'sousou-no-frieren-new-tank', file: 'Sousou No Frieren Edit ｜ New Tank (free project file) [6ZdKTaC54z8].mkv', youtube: '6ZdKTaC54z8' },
  { slug: 'uin-one-for-all', file: '', youtube: 'KbnBCMy2QwM' },
  { slug: 'ilusi-garis-kemiskinan', file: 'ILUSI GARIS KEMISKINAN.mp4' },
  { slug: 'rahmatan-lil-alamin', file: 'RLAA.mp4' },
  // Sumbernya 1920×1080 dengan isi kotak 1072×1072 di tengah (cropdetect): bar hitam kiri-kanan dibuang.
  { slug: 'sundays', file: 'Sundays2.mp4', crop: '1072:1072:424:4' },
];

/** Momen kandidat (pecahan durasi) yang diskor detailnya. */
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

/** Tempel `crop=w:h:x:y` di depan filter kalau karyanya punya crop (dipakai cuma buat sumber video lokal). */
function withCrop(crop, filter) {
  return crop ? `crop=${crop},${filter}` : filter;
}

/** Satu frame video (di detik `atS`), atau gambar diam, sebagai webp lebar 1280. */
function still(file, atS, out, filter = STILL_FILTER) {
  const seek = atS === null ? [] : ['-ss', atS.toFixed(2)];
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...seek, '-i', file, '-frames:v', '1', '-vf', filter, '-c:v', 'libwebp', '-quality', '78', out]);
}

/** Standar deviasi luma thumbnail abu-abu kecil: 0 buat frame polos (hitam), tinggi buat yang detail. */
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

function preview(file, atS, out, crop = null) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', atS.toFixed(2), '-t', String(PREVIEW_S), '-i', file,
    '-an', '-vf', withCrop(crop, 'scale=-2:720,fps=30'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ]);
}

/** Unduh thumbnail YouTube terbaik yang ada dan tulis jadi cover. */
async function youtubeCover(id, out) {
  for (const name of THUMBNAILS) {
    const response = await fetch(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/${name}.jpg`);
    if (!response.ok) continue;
    const tmp = join(tmpdir(), `yt-${id}-${name}.jpg`);
    writeFileSync(tmp, Buffer.from(await response.arrayBuffer()));
    try {
      // Thumbnail sd/hq itu kanvas 4:3 dengan gambar 16:9 yang letterbox di dalamnya: bar-nya di-crop.
      still(tmp, null, out, name === 'maxresdefault' ? STILL_FILTER : `crop=iw:trunc(iw*9/32)*2,${STILL_FILTER}`);
    } finally {
      rmSync(tmp, { force: true });
    }
    return name;
  }
  throw new Error(`no YouTube thumbnail for ${id}`);
}

/** Frame otomatis YouTube (hq1–hq3), letterbox di-crop ke 16:9, jadi styleframe. Balikannya jumlah yang ditulis. */
async function youtubeFrames(id, dir) {
  let count = 0;
  for (const name of ['hq1', 'hq2', 'hq3']) {
    const response = await fetch(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/${name}.jpg`);
    if (!response.ok) continue;
    const tmp = join(tmpdir(), `yt-${id}-${name}.jpg`);
    writeFileSync(tmp, Buffer.from(await response.arrayBuffer()));
    try {
      count += 1;
      still(tmp, null, join(dir, `f${count}.webp`), `crop=iw:trunc(iw*9/32)*2,${STILL_FILTER}`);
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  if (count === 0) throw new Error(`no YouTube frames for ${id}`);
  return count;
}

/** Hapus f<n>.webp di atas `count`, biar daftar frame yang lebih pendek nggak ninggalin frame basi. */
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
  const hasSource = Boolean(work.file) && existsSync(source);
  const length = hasSource ? duration(source) : 0;
  const scored = hasSource ? CANDIDATES.map((at) => ({ at: length * at, score: detail(source, length * at) })).sort((a, b) => b.score - a.score) : [];

  if (!work.youtube) {
    if (!hasSource) {
      console.warn(`skip ${work.slug}: missing ${work.file}`);
      continue;
    }
    const at = work.cover ? parseTimestamp(work.cover) : scored[0].at;
    still(source, at, join(dir, 'cover.webp'), withCrop(work.crop, STILL_FILTER));
    done.push(`cover @ ${at.toFixed(1)} s`);
  }

  let firstFrameAt = scored[0]?.at ?? 0;
  if (own.length) {
    own.forEach((name, i) => still(join(ownDir, name), null, join(dir, `f${i + 1}.webp`)));
    pruneFrames(dir, own.length);
    done.push(`${own.length} own frames`);
  } else if (!hasSource && work.youtube) {
    const count = await youtubeFrames(work.youtube, dir);
    pruneFrames(dir, count);
    done.push(`${count} frames ← youtube hq1–hq${count}`);
  } else if (!hasSource) {
    console.warn(`skip ${work.slug} styleframes: missing ${work.file} (and no local-media/frames/${work.slug}/)`);
  } else {
    // Mode auto melewati momen paling detail kalau itu sudah jadi cover.
    const skip = work.youtube || work.cover ? 0 : 1;
    const moments = work.frames?.length
      ? work.frames.map(parseTimestamp)
      : scored.slice(skip, skip + AUTO_FRAMES).map((s) => s.at).sort((a, b) => a - b);
    for (const at of moments) if (at > length) throw new Error(`${work.slug}: ${at} s is past the end (${length.toFixed(1)} s)`);
    moments.forEach((at, i) => still(source, at, join(dir, `f${i + 1}.webp`), withCrop(work.crop, STILL_FILTER)));
    pruneFrames(dir, moments.length);
    firstFrameAt = moments[0];
    done.push(`${moments.length} frames @ ${moments.map((at) => at.toFixed(1)).join(', ')} s`);
  }

  if (!onlyStills && hasSource) {
    mkdirSync(join(media, 'previews'), { recursive: true });
    const start = Math.max(0, Math.min(firstFrameAt, length - PREVIEW_S));
    preview(source, start, join(media, 'previews', `${work.slug}.mp4`), work.crop);
    done.push('preview');
  }
  console.log(`ok ${work.slug}: ${done.join(', ')}`);
}
