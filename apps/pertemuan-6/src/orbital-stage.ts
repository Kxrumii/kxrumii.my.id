import type { ViewMode, ViewPreference } from './types.ts';

export const ORBIT_LIMIT = 12;
export const ORBIT_REFLOW_TAU_MS = 65;
export const ORBIT_REFLOW_POS_EPSILON = 0.35;
export const ORBIT_REFLOW_SCALE_EPSILON = 0.002;
const GOLDEN_ANGLE = 2.39996323;
const INITIAL_AZIMUTH = -0.82;

export interface OrbitPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export interface BoxMeasure {
  width: number;
  height: number;
  captionWidth: number;
  captionHeight: number;
}

export interface OrbitalPlacement {
  index: number;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  captionX: number;
  captionY: number;
}

export interface OrbitalCoord {
  x: number;
  y: number;
  scale: number;
  captionX: number;
  captionY: number;
}

export interface OrbitalSyncOptions {
  animateReflow?: boolean;
}

export interface OrbitalStageController {
  sync(options?: OrbitalSyncOptions): void;
  setActive(active: boolean): void;
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  resetView(): void;
  destroy(): void;
}

export interface OrbitalStageOptions {
  onSelectTask(id: number): void;
  onPauseChange?(paused: boolean): void;
}

export interface OrbitalDriftState {
  active: boolean;
  count: number;
  manualPaused: boolean;
  dragging: boolean;
  reducedMotion: boolean;
  documentHidden: boolean;
  dialogOpen: boolean;
  keyboardFocused: boolean;
  routeTransitionActive: boolean;
}

/**
 * Menentukan apakah gerak idle orbital boleh berjalan.
 * Hover pointer tidak termasuk kondisi jeda; jeda hanya untuk pause manual,
 * drag aktif, reduced motion, tab tidak aktif, dialog terbuka, fokus keyboard, dan transisi rute.
 */
export function shouldIdleDrift(state: OrbitalDriftState): boolean {
  if (!state.active || state.count <= 1) return false;
  return !(
    state.manualPaused ||
    state.dragging ||
    state.reducedMotion ||
    state.documentHidden ||
    state.dialogOpen ||
    state.keyboardFocused ||
    state.routeTransitionActive
  );
}

/** Menentukan tampilan efektif: otomatis pindah ke daftar jika tugas tampak melebihi `ORBIT_LIMIT`. */
export function resolveEffectiveView(visibleCount: number, preference: ViewPreference): ViewMode {
  if (preference === 'orbit' || preference === 'list') return preference;
  return visibleCount > ORBIT_LIMIT ? 'list' : 'orbit';
}

/** Memotong daftar ke halaman orbital berukuran `pageSize` (indeks 1-based). */
export function paginateOrbit<T>(
  items: readonly T[],
  page: number,
  pageSize = ORBIT_LIMIT,
): OrbitPage<T> {
  if (items.length === 0) {
    return { items: [], page: 1, totalPages: 1, startIndex: 0, endIndex: 0 };
  }
  const safeSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.max(1, Math.min(totalPages, Math.trunc(page) || 1));
  const start = (safePage - 1) * safeSize;
  const sliced = items.slice(start, start + safeSize);
  return {
    items: sliced,
    page: safePage,
    totalPages,
    startIndex: start + 1,
    endIndex: start + sliced.length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isCoordConverged(a: OrbitalCoord, b: OrbitalCoord): boolean {
  return (
    Math.abs(a.x - b.x) < ORBIT_REFLOW_POS_EPSILON &&
    Math.abs(a.y - b.y) < ORBIT_REFLOW_POS_EPSILON &&
    Math.abs(a.captionX - b.captionX) < ORBIT_REFLOW_POS_EPSILON &&
    Math.abs(a.captionY - b.captionY) < ORBIT_REFLOW_POS_EPSILON &&
    Math.abs(a.scale - b.scale) < ORBIT_REFLOW_SCALE_EPSILON
  );
}

/** Menginterpolasi koordinat visual orbital satu langkah (`dtMs`) menuju target slot baru. */
export function stepOrbitalCoord(
  current: OrbitalCoord,
  target: OrbitalCoord,
  dtMs: number,
  tauMs = ORBIT_REFLOW_TAU_MS,
): { coord: OrbitalCoord; settled: boolean } {
  if (isCoordConverged(current, target)) {
    return { coord: { ...target }, settled: true };
  }
  if (dtMs <= 0) {
    return { coord: { ...current }, settled: false };
  }
  const alpha = Math.min(1, 1 - Math.exp(-dtMs / Math.max(1, tauMs)));
  const next: OrbitalCoord = {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    scale: current.scale + (target.scale - current.scale) * alpha,
    captionX: current.captionX + (target.captionX - current.captionX) * alpha,
    captionY: current.captionY + (target.captionY - current.captionY) * alpha,
  };
  if (isCoordConverged(next, target)) {
    return { coord: { ...target }, settled: true };
  }
  return { coord: next, settled: false };
}

/**
 * Memproyeksikan 0..N kotak tugas pada panggung orbital 2D/3D deterministik:
 * - 0 → kosong
 * - 1 → terpusat
 * - 2–3 → busur ekuatorial seimbang
 * - 4+ → proyeksi bola Fibonacci seperti referensi Edison Fang Workshop
 */
export function computeOrbitalPositions(
  count: number,
  stageWidth: number,
  stageHeight: number,
  boxes: readonly BoxMeasure[],
  azimuth: number,
  pitch: number,
): OrbitalPlacement[] {
  if (count <= 0 || stageWidth <= 0 || stageHeight <= 0) return [];

  const safePitch = clamp(pitch, -0.85, 0.85);
  const cosAz = Math.cos(azimuth);
  const sinAz = Math.sin(azimuth);
  const cosPi = Math.cos(safePitch);
  const sinPi = Math.sin(safePitch);

  const raw: Array<{ index: number; x: number; y: number; scale: number; zIndex: number }> = [];

  for (let idx = 0; idx < count; idx += 1) {
    const measure = boxes[idx] ?? { width: 150, height: 180, captionWidth: 120, captionHeight: 24 };
    let x = 0;
    let y = 0;
    let scale = 1;
    let depth = 0;

    if (count === 1) {
      x = 0;
      y = -10;
      scale = 1;
      depth = 1;
    } else if (count <= 3) {
      const angle = azimuth + (idx / count) * Math.PI * 2;
      const sx = Math.cos(angle);
      depth = Math.sin(angle);
      scale = 0.86 + (depth + 1) * 0.09;
      const maxX = Math.max(0, stageWidth / 2 - (measure.width * scale) / 2 - 18);
      const maxY = Math.max(0, stageHeight / 2 - (measure.height * scale) / 2 - 58);
      x = clamp(sx * stageWidth * 0.28, -maxX, maxX);
      y = clamp(Math.sin(angle + idx * 0.8) * Math.min(stageHeight * 0.14, 68) - depth * sinPi * 36, -maxY, maxY);
    } else {
      const lat = 1 - (2 * (idx + 0.5)) / count;
      const rad = Math.sqrt(Math.max(0, 1 - lat * lat));
      const theta = idx * GOLDEN_ANGLE;
      const sx = Math.cos(theta) * rad;
      const sz = Math.sin(theta) * rad;

      const rx = sx * cosAz + sz * sinAz;
      depth = -sx * sinAz + sz * cosAz;
      scale = 0.74 + (depth + 1) * 0.16;

      const maxX = Math.max(0, stageWidth / 2 - (measure.width * scale) / 2 - 14);
      const maxY = Math.max(0, stageHeight / 2 - (measure.height * scale) / 2 - 56);
      x = clamp(rx * stageWidth * 0.37, -maxX, maxX);
      y = clamp((lat * 0.82 * cosPi - depth * sinPi * 0.6) * stageHeight * 0.43, -maxY, maxY);
    }

    const zIndex = Math.round((depth + 2) * 20) * 16 + idx;
    raw.push({ index: idx, x, y, scale, zIndex });
  }

  return raw.map((item) => {
    const measure = boxes[item.index] ?? { width: 150, height: 180, captionWidth: 120, captionHeight: 24 };
    const boxW = measure.width * item.scale;
    const boxH = measure.height * item.scale;
    const capLeft = stageWidth / 2 + item.x - boxW / 2;
    const capTop = stageHeight / 2 + item.y + boxH / 2 + 8;
    const captionX = clamp(capLeft, 8, Math.max(8, stageWidth - measure.captionWidth - 8));
    const captionY = clamp(capTop, 8, Math.max(8, stageHeight - measure.captionHeight - 8));
    return { ...item, captionX, captionY };
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function isAnyDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

function isRouteTransitionActive(): boolean {
  return document.documentElement.hasAttribute('data-transition-state');
}

export function createOrbitalStage(
  stageEl: HTMLElement,
  options: OrbitalStageOptions,
): OrbitalStageController {
  let active = true;
  let manualPaused = false;
  let azimuth = INITIAL_AZIMUTH;
  let pitch = 0;
  let rafId = 0;
  let lastFrame = 0;
  let suppressClick = false;
  let pointer: { id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | null = null;

  let boxEls: HTMLButtonElement[] = [];
  let captionEls: Array<HTMLElement | null> = [];
  let stageWidth = stageEl.clientWidth;
  let stageHeight = stageEl.clientHeight;
  let measures: BoxMeasure[] = [];
  const displayCoords = new Map<number, OrbitalCoord>();
  let settling = false;

  function fitBoxTitles(): void {
    for (const box of boxEls) {
      const linesWrap = box.querySelector<HTMLElement>('.box-cover-lines');
      const printEl = box.querySelector<HTMLElement>('.box-print');
      if (!linesWrap || !printEl) continue;
      const prevTransform = box.style.transform;
      box.style.transform = 'none';
      linesWrap.style.setProperty('--box-fit', '1');
      const style = getComputedStyle(printEl);
      const innerWidth = Math.max(
        1,
        printEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      );
      let widest = innerWidth;
      for (const child of Array.from(linesWrap.children)) {
        const range = document.createRange();
        range.selectNodeContents(child);
        widest = Math.max(widest, range.getBoundingClientRect().width);
      }
      box.style.transform = prevTransform;
      linesWrap.style.setProperty('--box-fit', String(Math.min(1, (innerWidth * 0.96) / widest)));
    }
  }

  function measure(): void {
    boxEls = Array.from(stageEl.querySelectorAll<HTMLButtonElement>('.task-box:not([data-exiting="true"])'));
    const activeIds = new Set<number>();
    captionEls = boxEls.map((box) => {
      const taskId = box.dataset.taskId;
      if (!taskId) return null;
      const parsed = Number(taskId);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        activeIds.add(parsed);
      }
      return stageEl.querySelector<HTMLElement>(
        `.box-caption[data-caption-for="${taskId}"]:not([data-exiting="true"])`,
      );
    });
    for (const cachedId of Array.from(displayCoords.keys())) {
      if (!activeIds.has(cachedId)) {
        displayCoords.delete(cachedId);
      }
    }
    stageWidth = stageEl.clientWidth;
    stageHeight = stageEl.clientHeight;
    measures = boxEls.map((box, index) => ({
      width: box.offsetWidth || 150,
      height: box.offsetHeight || 180,
      captionWidth: captionEls[index]?.offsetWidth || 120,
      captionHeight: captionEls[index]?.offsetHeight || 24,
    }));
  }

  function canReflow(): boolean {
    return (
      active &&
      !prefersReducedMotion() &&
      !document.hidden &&
      !isAnyDialogOpen() &&
      !isRouteTransitionActive() &&
      pointer === null
    );
  }

  function applyPositions(dtMs = 0): void {
    if (!active || boxEls.length === 0) return;
    const placements = computeOrbitalPositions(
      boxEls.length,
      stageWidth,
      stageHeight,
      measures,
      azimuth,
      pitch,
    );
    if (settling && !canReflow()) {
      settling = false;
    }

    let anyUnsettled = false;
    const activeEl = document.activeElement;
    for (const p of placements) {
      const box = boxEls[p.index];
      const cap = captionEls[p.index];
      if (!box) continue;

      const taskId = Number(box.dataset.taskId);
      const target: OrbitalCoord = {
        x: p.x,
        y: p.y,
        scale: p.scale,
        captionX: p.captionX,
        captionY: p.captionY,
      };

      let coord = target;
      if (settling && Number.isSafeInteger(taskId) && taskId > 0 && displayCoords.has(taskId)) {
        const prev = displayCoords.get(taskId)!;
        if (dtMs > 0) {
          const step = stepOrbitalCoord(prev, target, dtMs);
          coord = step.coord;
          if (!step.settled) anyUnsettled = true;
        } else if (!isCoordConverged(prev, target)) {
          coord = prev;
          anyUnsettled = true;
        }
      }

      if (Number.isSafeInteger(taskId) && taskId > 0) {
        displayCoords.set(taskId, coord);
      }

      box.style.transform = `translate(-50%, -50%) translate3d(${coord.x.toFixed(2)}px, ${coord.y.toFixed(2)}px, 0) scale(${coord.scale.toFixed(4)})`;
      const focused = box === activeEl && stageEl.matches(':focus-within');
      const z = focused ? '1900' : String(p.zIndex);
      box.style.zIndex = z;
      if (cap) {
        cap.style.transform = `translate3d(${coord.captionX.toFixed(2)}px, ${coord.captionY.toFixed(2)}px, 0)`;
        cap.style.zIndex = z;
      }
    }

    if (settling && !anyUnsettled) {
      settling = false;
    }
  }

  function isKeyboardFocusedInside(): boolean {
    const activeEl = document.activeElement;
    return activeEl instanceof HTMLElement && stageEl.contains(activeEl) && activeEl.matches(':focus-visible');
  }

  function canIdleDrift(): boolean {
    return shouldIdleDrift({
      active,
      count: boxEls.length,
      manualPaused,
      dragging: pointer !== null,
      reducedMotion: prefersReducedMotion(),
      documentHidden: document.hidden,
      dialogOpen: isAnyDialogOpen(),
      keyboardFocused: isKeyboardFocusedInside(),
      routeTransitionActive: isRouteTransitionActive(),
    });
  }

  function stopLoop(): void {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastFrame = 0;
  }

  function tick(now: number): void {
    rafId = 0;
    const dt = lastFrame === 0 ? 16 : Math.min(40, Math.max(0, now - lastFrame));
    lastFrame = now;
    if (canIdleDrift()) {
      azimuth += dt * 0.000045;
    }
    applyPositions(dt);
    if (canIdleDrift() || pointer !== null || settling) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastFrame = 0;
    }
  }

  function requestFrame(): void {
    if (!active || rafId !== 0) return;
    if (!(canIdleDrift() || pointer !== null || settling)) return;
    rafId = requestAnimationFrame(tick);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!active || event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    settling = false;
    applyPositions(0);
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    stageEl.classList.add('is-dragging');
    stageEl.setPointerCapture(event.pointerId);
    requestFrame();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) {
      pointer.moved = true;
    }
    if (pointer.moved) {
      azimuth += (event.clientX - pointer.lastX) * 0.006;
      pitch = clamp(pitch + (event.clientY - pointer.lastY) * 0.006, -0.85, 0.85);
      applyPositions();
    }
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  }

  function onPointerEnd(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    const wasMoved = pointer.moved || event.type === 'pointercancel';
    pointer = null;
    stageEl.classList.remove('is-dragging');
    if (stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
    if (!wasMoved) {
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-id]');
      if (hit && hit.dataset.exiting !== 'true') {
        const taskId = Number(hit.dataset.taskId);
        if (Number.isSafeInteger(taskId) && taskId > 0) {
          options.onSelectTask(taskId);
        }
      }
    }
    requestFrame();
  }

  function onClick(event: MouseEvent): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const box = target?.closest<HTMLElement>('[data-task-id]');
    if (!box || box.dataset.exiting === 'true') return;
    const taskId = Number(box.dataset.taskId);
    if (Number.isSafeInteger(taskId) && taskId > 0) {
      options.onSelectTask(taskId);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!active) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      settling = false;
      azimuth += event.key === 'ArrowLeft' ? -0.3 : 0.3;
      applyPositions(0);
    }
  }

  function onFocusChange(): void {
    applyPositions(0);
    requestFrame();
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      if (settling) {
        settling = false;
        applyPositions(0);
      }
      stopLoop();
    } else {
      requestFrame();
    }
  }

  const ro = new ResizeObserver(() => {
    settling = false;
    measure();
    fitBoxTitles();
    applyPositions(0);
    requestFrame();
  });
  ro.observe(stageEl);

  const transitionObserver = new MutationObserver(() => {
    if (isRouteTransitionActive()) {
      if (settling) {
        settling = false;
        applyPositions(0);
      }
      stopLoop();
    } else {
      requestFrame();
    }
  });
  transitionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-transition-state'],
  });

  const dialogObserver = new MutationObserver(() => {
    if (isAnyDialogOpen()) {
      if (settling) {
        settling = false;
        applyPositions(0);
      }
      stopLoop();
    } else {
      requestFrame();
    }
  });
  for (const dialog of Array.from(document.querySelectorAll('dialog'))) {
    dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }

  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onMotionChange = (): void => {
    if (prefersReducedMotion()) {
      settling = false;
      stopLoop();
      applyPositions(0);
    } else {
      requestFrame();
    }
  };
  motionQuery?.addEventListener('change', onMotionChange);

  stageEl.addEventListener('pointerdown', onPointerDown);
  stageEl.addEventListener('pointermove', onPointerMove);
  stageEl.addEventListener('pointerup', onPointerEnd);
  stageEl.addEventListener('pointercancel', onPointerEnd);
  stageEl.addEventListener('click', onClick);
  stageEl.addEventListener('keydown', onKeyDown);
  stageEl.addEventListener('focusin', onFocusChange);
  stageEl.addEventListener('focusout', onFocusChange);
  document.addEventListener('visibilitychange', onVisibilityChange);

  void document.fonts?.ready.then(() => {
    measure();
    fitBoxTitles();
    applyPositions(0);
  });

  return {
    sync(syncOptions?: OrbitalSyncOptions): void {
      measure();
      fitBoxTitles();
      settling = Boolean(syncOptions?.animateReflow) && canReflow();
      applyPositions(0);
      requestFrame();
    },
    setActive(next: boolean): void {
      if (active === next) return;
      active = next;
      settling = false;
      displayCoords.clear();
      if (!active) {
        stopLoop();
      } else {
        measure();
        fitBoxTitles();
        applyPositions(0);
        requestFrame();
      }
    },
    setPaused(paused: boolean): void {
      manualPaused = paused;
      options.onPauseChange?.(manualPaused);
      if (manualPaused) {
        if (settling) {
          settling = false;
          applyPositions(0);
        }
        stopLoop();
      } else {
        requestFrame();
      }
    },
    isPaused(): boolean {
      return manualPaused;
    },
    resetView(): void {
      settling = false;
      azimuth = INITIAL_AZIMUTH;
      pitch = 0;
      applyPositions(0);
    },
    destroy(): void {
      stopLoop();
      ro.disconnect();
      transitionObserver.disconnect();
      dialogObserver.disconnect();
      motionQuery?.removeEventListener('change', onMotionChange);
      stageEl.removeEventListener('pointerdown', onPointerDown);
      stageEl.removeEventListener('pointermove', onPointerMove);
      stageEl.removeEventListener('pointerup', onPointerEnd);
      stageEl.removeEventListener('pointercancel', onPointerEnd);
      stageEl.removeEventListener('click', onClick);
      stageEl.removeEventListener('keydown', onKeyDown);
      stageEl.removeEventListener('focusin', onFocusChange);
      stageEl.removeEventListener('focusout', onFocusChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
