import { useSyncExternalStore } from 'react';
import {
  disableAll,
  duck,
  enableAll,
  getSnapshot,
  play,
  setMusicEnabled,
  setSfxEnabled,
  subscribe,
  toggleMusic,
  toggleSfx,
  unduck,
  type SoundName,
  type SoundSnapshot,
} from './soundEngine';
// Side effect: reports "unavailable" as soon as Music is on in a build without a playable track (see musicSource).
import './musicSource';

export interface SoundControls extends SoundSnapshot {
  enableAll: () => boolean;
  disableAll: () => void;
  setMusicEnabled: (on: boolean) => boolean;
  setSfxEnabled: (on: boolean) => boolean;
  toggleMusic: () => boolean;
  toggleSfx: () => boolean;
  play: (name: SoundName) => void;
  duck: () => void;
  unduck: () => void;
}

/** React view of the sound engine (state via useSyncExternalStore, actions are stable functions). */
export function useSound(): SoundControls {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...state, enableAll, disableAll, setMusicEnabled, setSfxEnabled, toggleMusic, toggleSfx, play, duck, unduck };
}
