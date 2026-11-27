import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { useSound } from '../audio/useSound';
import { profile } from '../data/profile';
import { markGatePassed } from '../shell/gate';
import { stagePath } from '../shell/navItems';
import { ShellContext } from '../shell/shellContext';
import { notifyRouteCommit, playGateHandOff, revealCanvas, transitionIndex, usePageReady } from '../transition';
import { LocalClock } from './LocalClock';
import { MenuSheet } from './MenuSheet';
import { MetaList } from './MetaList';
import { ShellNav } from './ShellNav';
import { ShellRail } from './ShellRail';
import { SoundGate } from './SoundGate';
import { SoundToggle } from './SoundToggle';

type GateState = 'open' | 'leaving' | 'done';

/**
 * Persistent application shell (Pacôme flow, Huy composition). The shell
 * elements carry `data-shell` and stay still during route transitions; only
 * the routed stage inside <main> moves.
 */
export function AppShell() {
  const { key, pathname } = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef<string | null>(null);
  const [gate, setGate] = useState<GateState>(() => (document.documentElement.dataset.gate ? 'open' : 'done'));
  const { enableAll, disableAll, play } = useSound();

  // page-ready is sent as soon as the shell (or the gate) is on screen; it never waits for the gate choice.
  usePageReady(key);

  // Layout effects run during the commit, so awaiting transitions see the new route's DOM.
  useLayoutEffect(() => {
    notifyRouteCommit();
  }, [key]);

  // Without a gate this session, hand the canvas off straight away (idempotent under StrictMode).
  useEffect(() => {
    if (gate === 'done') void revealCanvas();
  }, [gate]);

  // After a stage change, move focus to the content and reset scroll (Back/Forward keeps native restoration).
  // Opening or closing the work sheet (`/` <-> `/work/:slug`) is not a stage change: the sheet manages focus itself.
  const stage = stagePath(pathname);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = stage;
    if (previous === null || previous === stage) return;
    if (navigationType !== 'POP') window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [stage, navigationType]);

  const handleChoose = useCallback(
    (withSound: boolean) => {
      if (gate !== 'open') return;
      // Still inside the click: the AudioContext may start here, never earlier.
      // "With sound" switches Music and SFX on (the context is created inside this click); "without" leaves both off.
      if (withSound) {
        if (enableAll()) play('click');
      } else {
        disableAll();
      }
      markGatePassed();
      setGate('leaving');
      void playGateHandOff(() => {
        setGate('done');
        // A modal sheet that opened right after the gate keeps the focus.
        requestAnimationFrame(() => {
          if (!document.querySelector('dialog:modal')) mainRef.current?.focus({ preventScroll: true });
        });
      });
    },
    [gate, enableAll, disableAll, play],
  );

  const locked = gate !== 'done';
  const shellState = useMemo(() => ({ locked }), [locked]);

  return (
    <ShellContext.Provider value={shellState}>
      {gate !== 'done' ? <SoundGate onChoose={handleChoose} leaving={gate === 'leaving'} /> : null}
      <div className="shell" inert={locked}>
        <ShellRail />
        <header className="shell-top" data-shell="" data-transition-exit="" data-transition-enter="" style={transitionIndex(0)}>
          <ShellNav />
          <SoundToggle variant="text" className="shell-audio" />
          <div className="shell-identity">
            <MetaList
              items={[
                { label: 'Nama', value: profile.name },
                { label: 'NIM', value: profile.nim },
              ]}
            />
          </div>
          <LocalClock />
          <MenuSheet />
        </header>
        <main id="main" className="stage-host" ref={mainRef} tabIndex={-1}>
          <Outlet />
        </main>
        <div className="shell-corner" data-shell="" data-transition-exit="" data-transition-enter="" style={transitionIndex(2)}>
          <SoundToggle variant="round" />
        </div>
      </div>
    </ShellContext.Provider>
  );
}
