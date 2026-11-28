import { equalPowerCurve, planSongSegments, type SongLoopInput } from './loopPlan';

/*
 * Musik background: "Shelter (Official Piano Version)", di-loop utuh dengan crossfade 2 s.
 *
 * Soal hak: file-nya punyaku dan TIDAK PERNAH di-commit. Pas development dibaca dari apps/pertemuan-7/local-media/
 * (di-exclude dari Git); di production baru memutar `<base>/media/shelter.webm` kalau aku sendiri yang upload
 * file itu ke server. File nggak ada (404, atau index.html SPA yang malah tersaji) dianggap "tidak tersedia":
 * app diam, cuma ada bunyi interface.
 *
 * Fetch/decode dan crossfade satu-node-per-segment diadaptasi dari showroom Task 7 yang lama (branch archive/pertemuan-9-showroom).
 * Semua waktu dari clock AudioContext; interval cuma nentuin seberapa jauh node dibuat duluan. Pause gratis: pas sound
 * mati context di-suspend, clock-nya berhenti, jadi seluruh jadwal ikut berhenti.
 */

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

const FILE = 'shelter.webm';
const CROSSFADE_S = 2;
const LEAD_S = 0.08;
const ANTI_CLICK_S = 0.012;
const LOOKAHEAD_S = 3;
const TICK_MS = 400;

export function musicUrl(): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return import.meta.env?.DEV ? `${base}local-media/${FILE}` : `${base}media/${FILE}`;
}

async function loadBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(musicUrl());
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || type.includes('text/html')) throw new Error(`music unavailable (${response.status} ${type})`);
  return ctx.decodeAudioData(await response.arrayBuffer());
}

let started = false;

/**
 * Muat lagunya sekali lalu mulai loop crossfade tanpa putus ke `bus`. Hasilnya dikabarkan lewat `onStatus`.
 * Aman dipanggil berkali-kali, cuma panggilan pertama yang jalan.
 */
export function startMusic(ctx: AudioContext, bus: AudioNode, onStatus: (status: MusicStatus) => void): void {
  if (started) return;
  started = true;
  onStatus('loading');
  loadBuffer(ctx)
    .then((buffer) => {
      const input: SongLoopInput = { whenS: ctx.currentTime + LEAD_S, offsetS: 0, durationS: buffer.duration, crossfadeS: CROSSFADE_S };
      const curveIn = equalPowerCurve(64, 'in');
      const curveOut = equalPowerCurve(64, 'out');
      let next = 0;
      const schedule = () => {
        for (const segment of planSongSegments(input, ctx.currentTime + LOOKAHEAD_S, next)) {
          const node = ctx.createBufferSource();
          node.buffer = buffer;
          const gain = ctx.createGain();
          if (segment.fadeIn) {
            gain.gain.setValueCurveAtTime(curveIn, segment.fadeIn.from, segment.fadeIn.to - segment.fadeIn.from);
          } else {
            gain.gain.setValueAtTime(0, segment.startAt);
            gain.gain.linearRampToValueAtTime(1, segment.startAt + ANTI_CLICK_S);
          }
          gain.gain.setValueCurveAtTime(curveOut, segment.fadeOut.from, segment.fadeOut.to - segment.fadeOut.from);
          node.connect(gain).connect(bus);
          node.onended = () => {
            node.disconnect();
            gain.disconnect();
          };
          node.start(segment.startAt, segment.offset);
          node.stop(segment.endAt);
          next = segment.index + 1;
        }
      };
      schedule();
      window.setInterval(schedule, TICK_MS);
      onStatus('playing');
    })
    .catch((error: unknown) => {
      if (import.meta.env?.DEV) console.warn('[t7 music]', error);
      onStatus('unavailable');
    });
}
