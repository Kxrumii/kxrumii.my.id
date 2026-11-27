import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSilentClock, createTransport, type ClockSource } from '../src/showroom/transport.ts';

const CYCLE = 27.5;
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

/** Shared virtual time in seconds that tests advance by hand. */
function virtualTime() {
  const time = { t: 0 };
  return time;
}

/** A fake "music" source on a different time base, like AudioContext.currentTime. */
function fakeMusic(time: { t: number }, options: { base?: number; startLeadS?: number; latencyS?: number } = {}) {
  const log: string[] = [];
  const base = options.base ?? 1234.5;
  const source: ClockSource = {
    now: () => time.t + base,
    audibleNow: options.latencyS === undefined ? undefined : () => time.t + base - options.latencyS!,
    start(offset) {
      log.push(`start:${offset.toFixed(3)}`);
      return time.t + base + (options.startLeadS ?? 0);
    },
    stop() {
      log.push('stop');
    },
  };
  return { source, log };
}

test('silent clock converts milliseconds to seconds', () => {
  assert.equal(createSilentClock(() => 2500).now(), 2.5);
  assert.equal(createSilentClock(() => 0).now(), 0);
});

test('position advances only while playing and wraps at the cycle', () => {
  const time = virtualTime();
  const transport = createTransport({ source: createSilentClock(() => time.t * 1000), cycleS: CYCLE, startS: 1 });
  near(transport.position(), 1);
  time.t += 5;
  near(transport.position(), 1);
  transport.play();
  time.t += 2.5;
  near(transport.position(), 3.5);
  time.t += CYCLE;
  near(transport.position(), 3.5);
  transport.pause();
  time.t += 100;
  near(transport.position(), 3.5);
  assert.equal(transport.isPlaying(), false);
});

function script(transport: ReturnType<typeof createTransport>, time: { t: number }): number[] {
  const out: number[] = [];
  const sample = () => out.push(transport.position());
  transport.play();
  time.t += 1.7;
  sample();
  transport.pause();
  time.t += 3;
  sample();
  transport.play();
  time.t += 5.2;
  sample();
  transport.seek(4.4);
  time.t += 2;
  sample();
  transport.pause();
  transport.seek(0.5);
  sample();
  transport.play();
  time.t += CYCLE * 10 + 0.3;
  sample();
  transport.seek(-1);
  sample();
  return out;
}

test('SilentClock and MusicClock produce the same timeline positions for the same event script (no drift over 10 cycles)', () => {
  const t1 = virtualTime();
  const silent = createTransport({ source: createSilentClock(() => t1.t * 1000), cycleS: CYCLE });
  const t2 = virtualTime();
  const music = fakeMusic(t2);
  const audio = createTransport({ source: music.source, cycleS: CYCLE });

  const a = script(silent, t1);
  const b = script(audio, t2);
  a.forEach((value, i) => near(value, b[i], 1e-6));
  near(a[5], 0.5 + 0.3, 1e-6); // 10 full cycles later the position is back where it started
  near(a[6], CYCLE - 1, 1e-9); // negative seek wraps
});

test('swapping the clock source (audio on/off) keeps the timeline position, playing or paused', () => {
  const t = virtualTime();
  const transport = createTransport({ source: createSilentClock(() => t.t * 1000), cycleS: CYCLE });
  transport.play();
  t.t += 5;
  const before = transport.position();
  const music = fakeMusic(t);
  transport.setSource(music.source);
  near(transport.position(), before);
  assert.ok(transport.isPlaying());
  assert.deepEqual(music.log, ['start:5.000']);
  t.t += 1;
  near(transport.position(), before + 1);

  transport.pause();
  const paused = transport.position();
  transport.setSource(createSilentClock(() => t.t * 1000));
  near(transport.position(), paused);
  t.t += 50;
  near(transport.position(), paused);
  assert.deepEqual(music.log, ['start:5.000', 'stop']);
});

test('a hidden tab (pause/play) does not advance the position, and resuming is within 1 ms', () => {
  const t = virtualTime();
  const transport = createTransport({ source: createSilentClock(() => t.t * 1000), cycleS: CYCLE, startS: 2 });
  transport.play();
  t.t += 4.321;
  transport.pause();
  const saved = transport.position();
  t.t += 10;
  transport.play();
  assert.ok(Math.abs(transport.position() - saved) <= 0.001);
});

test('seek while playing stops then restarts the audio source at the new offset', () => {
  const t = virtualTime();
  const music = fakeMusic(t);
  const transport = createTransport({ source: music.source, cycleS: CYCLE });
  transport.play();
  t.t += 3;
  transport.seek(9);
  assert.deepEqual(music.log, ['start:0.000', 'stop', 'start:9.000']);
  near(transport.position(), 9);
  t.t += 1;
  near(transport.position(), 10);
});

test('a scheduled start lead holds the position until the audio actually begins', () => {
  const t = virtualTime();
  const music = fakeMusic(t, { startLeadS: 0.05 });
  const transport = createTransport({ source: music.source, cycleS: CYCLE, startS: 4 });
  transport.play();
  t.t += 0.02;
  near(transport.position(), 4);
  t.t += 1.03;
  near(transport.position(), 5);
});

test('visual position compensates output latency and applies the lead in the documented direction', () => {
  const t = virtualTime();
  const music = fakeMusic(t, { latencyS: 0.1 });
  const transport = createTransport({ source: music.source, cycleS: CYCLE, visualLeadMs: 20 });
  transport.play();
  t.t += 3;
  near(transport.position(), 3);
  // audible elapsed = 3 - 0.1; positive lead shows the visual earlier than the audio: + 0.02
  near(transport.visualPosition(), 3 - 0.1 + 0.02);
  transport.setVisualLeadMs(-30);
  near(transport.visualPosition(), 3 - 0.1 - 0.03);
  transport.pause();
  near(transport.visualPosition(), 3);
});

test('the silent clock ignores latency compensation and the visual lead (nothing to line up with)', () => {
  const t = virtualTime();
  const transport = createTransport({ source: createSilentClock(() => t.t * 1000), cycleS: CYCLE, visualLeadMs: 50 });
  transport.play();
  t.t += 2;
  near(transport.visualPosition(), transport.position());
});
