import { useSyncExternalStore } from 'react';
import { getSoundSnapshot, subscribeSound, type SoundSnapshot } from './sound';

/** Live sound state (enabled / supported). */
export function useSound(): SoundSnapshot {
  return useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundSnapshot);
}
