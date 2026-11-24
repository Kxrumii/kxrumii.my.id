import { createContext, useContext } from 'react';

export interface ShellState {
  /** True while the sound gate is open or leaving: overlays (top layer) must not open yet. */
  locked: boolean;
}

export const ShellContext = createContext<ShellState>({ locked: false });

export const useShell = (): ShellState => useContext(ShellContext);
