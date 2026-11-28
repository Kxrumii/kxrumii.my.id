/*
 * Geometri murni spiral (heliks 3D CSS, tanpa WebGL). Nggak nyentuh DOM, jadi bisa di-unit-test langsung.
 *
 * Spiral itu heliks vertikal berisi "slot". Slot i ada di offset d = i - p dari posisi kamera p (dalam slot):
 * berputar `STEP_DEG` per slot mengelilingi sumbu vertikal dan turun `rise` px per slot, jadi bagian depan
 * heliks adalah karya aktif dan sisanya melingkar menjauh di atas dan bawahnya, depan dan belakang.
 *
 * List pendek diulang mengelilingi heliks (slot i menampilkan karya i mod n) biar coil selalu kelihatan penuh;
 * urutan karyanya sendiri nggak pernah diubah.
 */

/** Rotasi antar slot: 360 / 30 = 12 slot per putaran penuh. */
export const STEP_DEG = 30;
/** Jumlah slot minimum begitu list di-loop (satu putaran penuh). */
export const MIN_SLOTS = 12;
/** Karya yang lebih sedikit dari ini nggak di-loop: tetap di busur pendek di depan kamera. */
export const LOOP_MIN_WORKS = 3;
/** Radius heliks dan langkah vertikal relatif ke ukuran kartu. RISE > 1 jaga tiap kartu tetap lepas dari tetangganya. */
export const RADIUS_PER_WIDTH = 1.25;
export const RISE_PER_HEIGHT = 1.2;

/*
 * Kamera scene, ditulis ke DOM oleh useSpiral (sumber tunggal: projectCard() di bawah pakai angka yang sama).
 * Origin scene ada di perspective origin, jadi proyeksinya perspective divide biasa di sekitarnya.
 */
export const PERSPECTIVE_PX = 1500;
export const ORIGIN_Y = 0.46;
export const TILT_X_DEG = -7;
export const TILT_Z_DEG = -4;

/** Kartu yang berputar lebih jauh dari ini dari kamera disembunyikan (cuma bagian depan coil yang kelihatan). */
const FACING_HIDE = 0.45;
const FACING_FULL = 0.75;

export function sceneTransform(radius: number): string {
  return `translateZ(${(-radius).toFixed(2)}px) rotateX(${TILT_X_DEG}deg) rotateZ(${TILT_Z_DEG}deg)`;
}

export function geometryFor(cardWidth: number, cardHeight: number): SpiralGeometry {
  return { radius: cardWidth * RADIUS_PER_WIDTH, rise: cardHeight * RISE_PER_HEIGHT };
}

export interface SpiralGeometry {
  radius: number;
  rise: number;
}

export interface CardPose {
  transform: string;
  opacity: number;
  /** cos(sudut): 1 = menghadap kamera, -1 = di belakang heliks. */
  facing: number;
  /** Boleh nerima input pointer atau nggak (setengah depan, jelas kelihatan). */
  interactive: boolean;
  /** Offset bertanda dari posisi kamera dalam slot (buat stagger enter/exit). */
  offset: number;
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function loops(workCount: number): boolean {
  return workCount >= LOOP_MIN_WORKS;
}

/** Jumlah slot di heliks buat `workCount` karya (kelipatan bulat dari pengulangan). */
export function slotCount(workCount: number): number {
  if (workCount <= 0) return 0;
  if (!loops(workCount)) return workCount;
  return Math.max(workCount, Math.ceil(MIN_SLOTS / workCount) * workCount);
}

export function workIndexForSlot(slot: number, workCount: number): number {
  if (workCount <= 0) return -1;
  return ((Math.round(slot) % workCount) + workCount) % workCount;
}

/** Offset slot dari posisi p, di-wrap ke [-slots/2, slots/2) kalau heliks di-loop. */
export function slotOffset(slot: number, p: number, slots: number, looping: boolean): number {
  let d = slot - finite(p);
  if (looping && slots > 0) {
    const half = slots / 2;
    d = ((((d + half) % slots) + slots) % slots) - half;
  }
  return finite(d);
}

export function activeSlot(p: number, slots: number): number {
  if (slots <= 0) return -1;
  return ((Math.round(finite(p)) % slots) + slots) % slots;
}

export function activeWorkIndex(p: number, workCount: number): number {
  return workIndexForSlot(activeSlot(p, slotCount(workCount)), workCount);
}

export function cardPose(slot: number, p: number, slots: number, looping: boolean, geometry: SpiralGeometry): CardPose {
  const d = slotOffset(slot, p, slots, looping);
  const angle = d * STEP_DEG;
  const y = d * geometry.rise;
  const facing = Math.cos((angle * Math.PI) / 180);
  // Memudar ke ujung coil (dan di sambungan loop, biar loncatan wrap nggak pernah kelihatan).
  const reach = looping ? slots / 2 : Math.max(slots, 2);
  const endFade = clamp01((reach - Math.abs(d)) / 2.5);
  // Cuma bagian depan heliks yang kelihatan: kartu memudar pas berputar menyamping.
  const depthFade = clamp01((facing - FACING_HIDE) / (FACING_FULL - FACING_HIDE));
  const opacity = finite(endFade * depthFade, 0);
  return {
    transform: `translate3d(-50%, -50%, 0) translate3d(0, ${y.toFixed(2)}px, 0) rotateY(${angle.toFixed(3)}deg) translateZ(${finite(geometry.radius).toFixed(2)}px)`,
    opacity: Number(opacity.toFixed(3)),
    facing,
    interactive: facing > 0.35 && opacity > 0.5,
    offset: d,
  };
}

/** Posisi target terpendek yang menampilkan `workIndex`, diukur dari p. */
export function nearestPositionFor(workIndex: number, p: number, workCount: number): number {
  const slots = slotCount(workCount);
  if (slots <= 0) return 0;
  if (!loops(workCount)) return Math.min(Math.max(Math.round(workIndex), 0), workCount - 1);
  const current = Math.round(finite(p));
  let best = current;
  let bestDistance = Infinity;
  // Semua slot yang menampilkan karya ini jadi kandidat; ambil yang paling dekat ke p.
  for (let base = current - slots; base <= current + slots; base += 1) {
    if (workIndexForSlot(base, workCount) !== workIndex) continue;
    const distance = Math.abs(base - p);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = base;
    }
  }
  return best;
}

export interface Viewport {
  width: number;
  height: number;
}

export type Point = readonly [number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Sudut kartu sebuah slot di layar, persis mengikuti rantai CSS: kartu `translate(0, y) rotateY(a)
 * translateZ(R)` di sekitar pusatnya, scene `translateZ(-R) rotateX(TILT_X) rotateZ(TILT_Z)`, lalu perspective
 * PERSPECTIVE_PX di sekitar (50%, ORIGIN_Y). Balikannya null kalau ada sudut yang jatuh di belakang kamera.
 */
export function projectCard(
  slot: number,
  p: number,
  slots: number,
  looping: boolean,
  geometry: SpiralGeometry,
  card: { width: number; height: number },
  viewport: Viewport,
): Point[] | null {
  const d = slotOffset(slot, p, slots, looping);
  const a = rad(d * STEP_DEG);
  const cx = rad(TILT_X_DEG);
  const cz = rad(TILT_Z_DEG);
  const ox = viewport.width / 2;
  const oy = viewport.height * ORIGIN_Y;
  const corners: Point[] = [];
  for (const [qx, qy] of [
    [-card.width / 2, -card.height / 2],
    [card.width / 2, -card.height / 2],
    [card.width / 2, card.height / 2],
    [-card.width / 2, card.height / 2],
  ] as const) {
    // Kartu: rotateY(a) dari (qx, qy, R), lalu translate y.
    let x = qx * Math.cos(a) + geometry.radius * Math.sin(a);
    let y = qy + d * geometry.rise;
    let z = -qx * Math.sin(a) + geometry.radius * Math.cos(a);
    // Scene: rotateZ, lalu rotateX, lalu translateZ(-R) (CSS menerapkan fungsi paling kanan duluan).
    [x, y] = [x * Math.cos(cz) - y * Math.sin(cz), x * Math.sin(cz) + y * Math.cos(cz)];
    [y, z] = [y * Math.cos(cx) - z * Math.sin(cx), y * Math.sin(cx) + z * Math.cos(cx)];
    z -= geometry.radius;
    if (z >= PERSPECTIVE_PX - 1) return null;
    const scale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);
    corners.push([ox + x * scale, oy + y * scale]);
  }
  return corners;
}

/** Separating-axis test buat dua poligon konveks (true = beririsan dengan luas positif). */
export function polygonsOverlap(a: readonly Point[], b: readonly Point[], epsilon = 0.5): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      const length = Math.hypot(nx, ny) || 1;
      const project = (pts: readonly Point[]) => pts.map(([x, y]) => (x * nx + y * ny) / length);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) + epsilon || Math.max(...pb) <= Math.min(...pa) + epsilon) return false;
    }
  }
  return true;
}
