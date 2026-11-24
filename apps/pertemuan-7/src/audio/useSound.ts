import { useSyncExternalStore } from 'react';
import {
  disable,
  duck,
  enable,
  getSnapshot,
  play,
  subscribe,
  toggle,
  unduck,
  type SoundName,
  type SoundSnapshot,
} from './soundEngine';

export interface SoundControls extends SoundSnapshot {
  enable: () => boolean;
  disable: () => void;
  toggle: () => void;
  play: (name: SoundName) => void;
  duck: () => void;
  unduck: () => void;
}

/** React view of the sound engine (state via useSyncExternalStore, actions are stable functions). */
export function useSound(): SoundControls {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...state, enable, disable, toggle, play, duck, unduck };
}
