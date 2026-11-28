/*
 * Pixel stars: logika state murni buat layer bintang di background.
 *
 * Diadaptasi dari "Background Pixel Stars" karya @uicapsule di 21st.dev (copy-nya aku sendiri yang sediakan).
 * Parameter visualnya dipertahankan: palet 16-bit, pixel 5 px, densitas, twinkle bertahap, regenerasi sebagian,
 * dan shooting star berpixel di tick retro 16 fps. Yang beda: randomness bisa di-inject (buat test), bintang
 * punya delay reveal biar bisa muncul menyebar dari satu titik, shooting star dijadwal dari waktu yang berlalu
 * bukan rantai setTimeout yang nggak dibersihin, dan semuanya pakai CSS pixel (canvas diskalakan buat devicePixelRatio).
 */

export type Rng = () => number;

export const STAR_COLORS = ['#FFFFFF', '#FFFFAA', '#AAAAFF', '#FFAAAA', '#AAFFAA', '#FFAAFF', '#AAFFFF'] as const;

export const STAR_CONFIG = {
  density: 0.00004,
  twinkleProbability: 0.7,
  minTwinkleS: 2,
  maxTwinkleS: 4,
  pixelSize: 5,
  regenerateEveryMs: 5000,
  regenerateFraction: 0.15,
  shootingPixelSize: 2,
  fps: 16,
  shootingMinDelayMs: 2000,
  shootingMaxDelayMs: 6000,
} as const;

export interface BackgroundStar {
  x: number;
  y: number;
  color: string;
  baseOpacity: number;
  currentOpacity: number;
  twinkle: boolean;
  twinkleSpeed: number;
  /** -1 fade out, 1 fade in. */
  twinkleDirection: number;
  twinkleTimer: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
}

export interface ShootingStar {
  x: number;
  y: number;
  /** Derajat; 90 = lurus ke bawah. */
  angle: number;
  speed: number;
  distance: number;
  trail: TrailPoint[];
}

export function starCount(width: number, height: number): number {
  return Math.max(0, Math.floor(width * height * STAR_CONFIG.density));
}

export function createStar(width: number, height: number, rng: Rng): BackgroundStar {
  const { pixelSize, twinkleProbability, minTwinkleS, maxTwinkleS } = STAR_CONFIG;
  const baseOpacity = rng() * 0.5 + 0.5;
  return {
    x: Math.floor(rng() * (width / pixelSize)) * pixelSize,
    y: Math.floor(rng() * (height / pixelSize)) * pixelSize,
    color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length) % STAR_COLORS.length],
    baseOpacity,
    currentOpacity: baseOpacity,
    twinkle: rng() < twinkleProbability,
    twinkleSpeed: minTwinkleS + rng() * (maxTwinkleS - minTwinkleS),
    twinkleDirection: -1,
    twinkleTimer: 0,
  };
}

export function createStars(width: number, height: number, rng: Rng): BackgroundStar[] {
  return Array.from({ length: starCount(width, height) }, () => createStar(width, height, rng));
}

/** Ganti sebagian bintang di tempat (minimal satu); balikannya index yang diganti. */
export function regenerateStars(stars: BackgroundStar[], width: number, height: number, rng: Rng): number[] {
  if (stars.length === 0) return [];
  const count = Math.max(1, Math.floor(stars.length * STAR_CONFIG.regenerateFraction));
  const replaced: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(rng() * stars.length) % stars.length;
    stars[index] = createStar(width, height, rng);
    replaced.push(index);
  }
  return replaced;
}

/** Satu tick 16 fps twinkle bertahap sebuah bintang (dua level terang, tanpa fade halus). */
export function stepTwinkle(star: BackgroundStar): void {
  if (!star.twinkle) return;
  star.twinkleTimer += 1 / STAR_CONFIG.fps;
  if (star.twinkleTimer >= star.twinkleSpeed) {
    star.twinkleTimer = 0;
    star.twinkleDirection *= -1;
  }
  const firstHalf = star.twinkleTimer / star.twinkleSpeed < 0.5;
  const bright = firstHalf ? star.twinkleDirection < 0 : star.twinkleDirection > 0;
  star.currentOpacity = bright ? star.baseOpacity : star.baseOpacity * 0.3;
}

export function createShootingStar(width: number, rng: Rng): ShootingStar {
  return { x: rng() * width, y: 0, angle: 45 + rng() * 90, speed: rng() * 5 + 8, distance: 0, trail: [] };
}

export function nextShootingDelayMs(rng: Rng): number {
  return STAR_CONFIG.shootingMinDelayMs + rng() * (STAR_CONFIG.shootingMaxDelayMs - STAR_CONFIG.shootingMinDelayMs);
}

/** Satu tick 16 fps: gerak, jatuhin pixel trail tiap ~8 px, pudarin trail, buang bintang yang keluar layar. */
export function stepShootingStars(stars: ShootingStar[], width: number, height: number): ShootingStar[] {
  return stars
    .map((star) => {
      const rad = (star.angle * Math.PI) / 180;
      const distance = star.distance + star.speed;
      const trail = [...star.trail];
      if (distance % 8 < star.speed) trail.push({ x: star.x, y: star.y, opacity: 1 });
      return {
        ...star,
        x: star.x + star.speed * Math.cos(rad),
        y: star.y + star.speed * Math.sin(rad),
        distance,
        trail: trail.map((point) => ({ ...point, opacity: point.opacity - 0.1 })).filter((point) => point.opacity > 0),
      };
    })
    .filter((star) => star.x >= -30 && star.x <= width + 30 && star.y >= -30 && star.y <= height + 30);
}

/** PRNG berseed (mulberry32) buat test yang deterministik. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
