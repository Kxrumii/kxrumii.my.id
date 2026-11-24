/*
 * Damped spring sampled into a CSS `linear()` easing.
 * Own implementation (semi-implicit Euler integration of m·x'' = -k(x-1) - c·x'),
 * so the curve can be tuned here instead of copying an easing string.
 */
interface SpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  points?: number;
}

const FALLBACK_EASING = 'cubic-bezier(.16, 1, .3, 1)';

export function springLinearEasing({ stiffness = 170, damping = 20, mass = 1, points = 48 }: SpringOptions = {}): string {
  const dt = 1 / 600;
  const samples: number[] = [];
  let x = 0;
  let v = 0;
  let t = 0;
  // Integrate until the spring has settled (or a hard cap of 3 s).
  while (t < 3) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    samples.push(x);
    if (Math.abs(1 - x) < 0.0005 && Math.abs(v) < 0.005) break;
  }
  const stops: string[] = ['0'];
  for (let i = 1; i < points; i += 1) {
    const value = samples[Math.min(samples.length - 1, Math.round((i / points) * (samples.length - 1)))];
    stops.push(String(Math.round(value * 10000) / 10000));
  }
  stops.push('1');
  return `linear(${stops.join(', ')})`;
}

/** Publishes `--ease-spring` on :root; browsers without `linear()` keep the cubic-bezier fallback. */
export function installSpringEasing(root: HTMLElement = document.documentElement): void {
  const spring = springLinearEasing();
  const supported = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');
  root.style.setProperty('--ease-spring', supported ? spring : FALLBACK_EASING);
}
