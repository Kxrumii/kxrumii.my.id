import assert from 'node:assert/strict';
import { test } from 'node:test';
import { command, embedUrl, INITIAL_SNAPSHOT, listening, parseMessage, playedFraction, reduce, seekTarget } from '../src/video/youtubeBridge.ts';

test('the embed URL hides YouTube chrome, enables the JS API and uses the no-cookie host', () => {
  const url = new URL(embedUrl('X7lZLkjGXXk', 'https://kxrumii.my.id'));
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, '/embed/X7lZLkjGXXk');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('controls'), '0');
  assert.equal(url.searchParams.get('origin'), 'https://kxrumii.my.id');
});

test('commands and the listening handshake are widget-channel JSON', () => {
  assert.deepEqual(JSON.parse(command('seekTo', [12, true])), { event: 'command', func: 'seekTo', args: [12, true], id: 'p7-player', channel: 'widget' });
  assert.deepEqual(JSON.parse(listening()), { event: 'listening', id: 'p7-player', channel: 'widget' });
});

test('messages are accepted only from YouTube origins and only when well formed', () => {
  const data = JSON.stringify({ event: 'onReady', info: null });
  assert.deepEqual(parseMessage('https://www.youtube-nocookie.com', data), { event: 'onReady', info: null });
  assert.equal(parseMessage('https://evil.example', data), null);
  assert.equal(parseMessage('https://www.youtube.com', '{not json'), null);
  assert.equal(parseMessage('https://www.youtube.com', JSON.stringify({ nope: 1 })), null);
});

test('info deliveries update time, duration, mute and play state', () => {
  let s = reduce(INITIAL_SNAPSHOT, { event: 'onReady', info: null });
  assert.equal(s.ready, true);
  s = reduce(s, { event: 'infoDelivery', info: { currentTime: 12.5, duration: 50, playerState: 1, muted: true } });
  assert.deepEqual([s.currentTime, s.duration, s.playing, s.muted], [12.5, 50, true, true]);
  s = reduce(s, { event: 'onStateChange', info: 2 });
  assert.equal(s.playing, false);
  s = reduce(s, { event: 'onStateChange', info: 0 });
  assert.equal(s.ended, true);
  assert.equal(reduce(s, { event: 'somethingElse', info: 1 }), s);
  // Angka aneh diabaikan.
  assert.equal(reduce(s, { event: 'infoDelivery', info: { currentTime: Number.NaN } }).currentTime, s.currentTime);
});

test('seeking and progress are clamped', () => {
  assert.equal(seekTarget(150, 100, 200, 60), 15);
  assert.equal(seekTarget(0, 100, 200, 60), 0);
  assert.equal(seekTarget(999, 100, 200, 60), 60);
  assert.equal(seekTarget(150, 100, 0, 60), 0);
  assert.equal(playedFraction({ currentTime: 30, duration: 60 }), 0.5);
  assert.equal(playedFraction({ currentTime: 5, duration: 0 }), 0);
});
