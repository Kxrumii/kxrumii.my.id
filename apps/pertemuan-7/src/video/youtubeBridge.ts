/*
 * Talking to a YouTube embed without loading YouTube's iframe_api script: the embed (with enablejsapi=1) accepts
 * JSON commands through postMessage and, once told we are "listening", reports its state back. Pure helpers only
 * (no DOM), so the protocol is unit-tested; VideoPlayer.tsx does the posting and listening.
 */

export const YOUTUBE_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'] as const;

/** YouTube player states. */
export const PlayerState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export interface PlayerSnapshot {
  ready: boolean;
  /** playing or buffering. */
  playing: boolean;
  ended: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
}

export const INITIAL_SNAPSHOT: PlayerSnapshot = { ready: false, playing: false, ended: false, muted: false, currentTime: 0, duration: 0 };

export type Command = 'playVideo' | 'pauseVideo' | 'mute' | 'unMute' | 'seekTo' | 'unloadModule';

/** Embed URL: no YouTube chrome (our controls replace it), JS API on, autoplay after the user's click. */
export function embedUrl(videoId: string, origin: string): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    controls: '0',
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    modestbranding: '1',
    fs: '0',
    cc_load_policy: '0',
    origin,
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function command(func: Command, args: unknown[] = [], id = 'p7-player'): string {
  return JSON.stringify({ event: 'command', func, args, id, channel: 'widget' });
}

/** Asks the embed to start sending onReady / infoDelivery messages. */
export function listening(id = 'p7-player'): string {
  return JSON.stringify({ event: 'listening', id, channel: 'widget' });
}

export interface YouTubeMessage {
  event: string;
  info: unknown;
}

/** Parses a message event's data, accepting only YouTube's origins and well-formed JSON objects. */
export function parseMessage(origin: string, data: unknown): YouTubeMessage | null {
  if (!(YOUTUBE_ORIGINS as readonly string[]).includes(origin)) return null;
  let value: unknown = data;
  if (typeof data === 'string') {
    try {
      value = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || typeof (value as { event?: unknown }).event !== 'string') return null;
  const { event, info } = value as { event: string; info?: unknown };
  return { event, info: info ?? null };
}

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** Folds a YouTube message into the player snapshot (unknown events leave it unchanged). */
export function reduce(snapshot: PlayerSnapshot, message: YouTubeMessage): PlayerSnapshot {
  if (message.event === 'onReady') return { ...snapshot, ready: true };
  const fromState = (state: number | undefined): Partial<PlayerSnapshot> =>
    state === undefined
      ? {}
      : { playing: state === PlayerState.playing || state === PlayerState.buffering, ended: state === PlayerState.ended };
  if (message.event === 'onStateChange') return { ...snapshot, ready: true, ...fromState(num(message.info)) };
  if ((message.event === 'infoDelivery' || message.event === 'initialDelivery') && message.info && typeof message.info === 'object') {
    const info = message.info as Record<string, unknown>;
    const next: PlayerSnapshot = { ...snapshot, ready: true, ...fromState(num(info.playerState)) };
    const time = num(info.currentTime);
    const duration = num(info.duration);
    if (time !== undefined) next.currentTime = Math.max(0, time);
    if (duration !== undefined && duration > 0) next.duration = duration;
    if (typeof info.muted === 'boolean') next.muted = info.muted;
    return next;
  }
  return snapshot;
}

/** Seek target (seconds) for a pointer at `x` over a scrubber spanning [left, left + width]. */
export function seekTarget(x: number, left: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0;
  const fraction = Math.min(Math.max((x - left) / width, 0), 1);
  return fraction * duration;
}

/** Fraction of the video already played (0–1). */
export function playedFraction(snapshot: Pick<PlayerSnapshot, 'currentTime' | 'duration'>): number {
  if (!(snapshot.duration > 0)) return 0;
  return Math.min(Math.max(snapshot.currentTime / snapshot.duration, 0), 1);
}
