import { createSilentClock, createTransport, type Transport } from './transport.ts';

/*
 * The shared master transport lives at module level so the timeline position survives view switches
 * (Gallery <-> List), the work sheet and route changes: there is exactly one timeline, owned by nobody's component.
 * In M3 the music source is swapped in here with transport.setSource() on the same transport.
 */
let shared: Transport | null = null;

let seated = false;

/** True once the timeline has been placed on a hold for the first time this session (later mounts keep the position). */
export function takeFirstSeat(): boolean {
  const first = !seated;
  seated = true;
  return first;
}

export function sharedTransport(cycleS: number): Transport {
  if (!shared || shared.cycleS !== cycleS) {
    shared?.pause();
    shared = createTransport({ source: createSilentClock(), cycleS });
  }
  return shared;
}
