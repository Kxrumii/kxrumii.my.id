import { useState } from 'react';
import { BEAT_S, DEFAULT_TUNE, TUNE, TUNE_STORAGE_KEY, type Tune } from '../showroom/tempo';

/**
 * Development-only tuning panel (open the app with `?tune`). It edits the camera tempo and curve, saves them to
 * localStorage and reloads, because the choreography is built once at load. Never rendered in production builds.
 * Once the owner is happy, the values are copied into DEFAULT_TUNE (src/showroom/tempo.ts).
 */
export function TunePanel() {
  const [tune, setTune] = useState<Tune>(TUNE);
  const set = (patch: Partial<Tune>) => setTune((t) => ({ ...t, ...patch }));
  const setBezier = (i: number, value: number) => set({ bezier: tune.bezier.map((v, j) => (j === i ? value : v)) as unknown as Tune['bezier'] });

  const save = () => {
    localStorage.setItem(TUNE_STORAGE_KEY, JSON.stringify(tune));
    location.reload();
  };
  const reset = () => {
    localStorage.removeItem(TUNE_STORAGE_KEY);
    location.reload();
  };

  const row = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, unit = '') => (
    <label className="tune-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {value}
        {unit}
      </output>
    </label>
  );

  return (
    <aside className="tune-panel" aria-label="Tuning (dev)">
      <p className="tune-title">tune · dev only</p>
      {row('transit', tune.transitBeats, 1, 8, 1, (v) => set({ transitBeats: v }), ` beat (${(tune.transitBeats * BEAT_S).toFixed(2)} s)`)}
      {row('hold', tune.holdBeats, 2, 24, 1, (v) => set({ holdBeats: v }), ` beat (${(tune.holdBeats * BEAT_S).toFixed(2)} s)`)}
      {row('x1', tune.bezier[0], 0, 1, 0.01, (v) => setBezier(0, v))}
      {row('y1', tune.bezier[1], -0.5, 1.5, 0.01, (v) => setBezier(1, v))}
      {row('x2', tune.bezier[2], 0, 1, 0.01, (v) => setBezier(2, v))}
      {row('y2', tune.bezier[3], -0.5, 1.5, 0.01, (v) => setBezier(3, v))}
      {row('distance', tune.distanceScale, 0.6, 1.6, 0.05, (v) => set({ distanceScale: v }), '×')}
      <p className="tune-code">cubic-bezier({tune.bezier.join(', ')})</p>
      <div className="tune-actions">
        <button type="button" onClick={save}>
          apply (reload)
        </button>
        <button type="button" onClick={reset}>
          reset to {DEFAULT_TUNE.transitBeats}/{DEFAULT_TUNE.holdBeats}
        </button>
      </div>
    </aside>
  );
}
