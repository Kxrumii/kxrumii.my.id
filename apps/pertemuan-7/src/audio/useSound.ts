import { useSyncExternalStore } from 'react';
import { getSoundSnapshot, subscribeSound, type SoundSnapshot } from './sound';

export function useSound(): SoundSnapshot {
  return useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundSnapshot);
}
