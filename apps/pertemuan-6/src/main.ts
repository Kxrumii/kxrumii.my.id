import { bridge } from './transition.ts';
import './style.css';
import { FILTER_LABELS, isTaskFilter, normalizeSearchQuery, queryTasks, type TaskFilter } from './filters.ts';
import {
  EASE_EXIT,
  EASE_OUT,
  STAGGER_MAX_ITEMS,
  STAGGER_STEP_MS,
  animateElement,
  bindBridgeCancellation,
  canAnimate,
  cancelMotionGroup,
  computeFlipDelta,
  computeStaggerDelays,
  createDeleteCoordinator,
  intersectsViewport,
  registerTransitionFlush,
  type RectLike,
} from './motion.ts';
import { ORBIT_LIMIT, createOrbitalStage, paginateOrbit, resolveEffectiveView } from './orbital-stage.ts';
import { initReaderDialog } from './reader-dialog.ts';
import {
  filterButton,
  reconcileAccessibleList,
  reconcileOrbitalStage,
  renderFilterBar,
  renderRangeIndex,
  renderSummary,
  requireElement,
} from './render.ts';
import { initThemeToggle } from './theme.ts';
import { initDeleteDialog } from './delete-dialog.ts';
import { initTaskDialog } from './task-dialog.ts';
import {
  describeLoad,
  describeSaveFailure,
  getBrowserStorage,
  loadTasks,
  loadViewMode,
  saveTasks,
  saveViewMode,
} from './storage.ts';
import { createTask, removeTask, survivorId, toggleStatus, updateTask } from './tasks.ts';
import type { Task, ViewMode } from './types.ts';

const appName: string = import.meta.env.VITE_APP_NAME || 'Task Manager';

// State dipulihkan dari localStorage (divalidasi) sebelum render pertama; bila gagal, mulai kosong di memori.
let tasks: Task[] = [];
// Filter dan query pencarian bersifat sementara per sesi.
let filter: TaskFilter = 'all';
let searchQuery = '';
let savedPreference: ViewMode = 'list';
let selectedView: ViewMode = 'list';
let orbitPage = 1;
let searchAnnounceTimer = 0;

try {
  initThemeToggle(requireElement(document, '#theme-toggle', HTMLButtonElement));

  requireElement(document, '#page-title', HTMLHeadingElement).textContent = appName;

  const orbitalView = requireElement(document, '#orbital-view', HTMLElement);
  const stageEl = requireElement(document, '#task-stage', HTMLElement);
  const orbitPager = requireElement(document, '#orbit-pager', HTMLElement);
  const orbitPrev = requireElement(document, '#orbit-prev', HTMLButtonElement);
  const orbitNext = requireElement(document, '#orbit-next', HTMLButtonElement);
  const orbitPageLabel = requireElement(document, '#orbit-page-label', HTMLElement);

  const listView = requireElement(document, '#list-view', HTMLElement);
  const listEl = requireElement(document, '#task-list', HTMLOListElement);

  const boxTemplate = requireElement(document, '#task-box-template', HTMLTemplateElement);
  const rowTemplate = requireElement(document, '#task-list-row-template', HTMLTemplateElement);

  const emptyState = requireElement(document, '#empty-state', HTMLElement);
  const filterEmpty = requireElement(document, '#filter-empty', HTMLElement);
  const filterEmptyEyebrow = requireElement(document, '#filter-empty-eyebrow', HTMLElement);
  const filterEmptyTitle = requireElement(document, '#filter-empty-title', HTMLElement);
  const filterEmptyHint = requireElement(document, '#filter-empty-hint', HTMLElement);
  const emptyAdd = requireElement(document, '#add-task-button', HTMLButtonElement);
  const headerAdd = requireElement(document, '#add-task-header', HTMLButtonElement);
  const showAll = requireElement(document, '#show-all-button', HTMLButtonElement);

  const utilityBar = requireElement(document, '#utility-bar', HTMLElement);
  const filterBar = requireElement(document, '#filter-bar', HTMLElement);
  const searchInput = requireElement(document, '#task-search', HTMLInputElement);
  const searchClear = requireElement(document, '#search-clear', HTMLButtonElement);
  const storageNotice = requireElement(document, '#storage-notice', HTMLElement);
  const viewNotice = requireElement(document, '#view-notice', HTMLElement);
  const viewNoticeText = requireElement(document, '#view-notice-text', HTMLElement);
  const viewOrbitForce = requireElement(document, '#view-orbit-force', HTMLButtonElement);
  const liveStatus = requireElement(document, '#live-status', HTMLElement);

  const rangeIndex = requireElement(document, '#range-index', HTMLElement);
  const summaryEl = requireElement(document, '#task-summary', HTMLElement);
  const viewOrbitBtn = requireElement(document, '#view-orbit', HTMLButtonElement);
  const viewListBtn = requireElement(document, '#view-list', HTMLButtonElement);
  const pauseBtn = requireElement(document, '#stage-pause', HTMLButtonElement);

  const storage = getBrowserStorage();
  const loaded = loadTasks(storage);
  tasks = loaded.tasks;
  savedPreference = loadViewMode(storage);
  selectedView = savedPreference;
  let notice: string | null = describeLoad(loaded);

  function showNotice(message: string | null): void {
    notice = message;
    storageNotice.textContent = message ?? '';
    storageNotice.hidden = message === null;
  }

  function persist(): void {
    const result = saveTasks(storage, tasks);
    showNotice(result.ok ? null : describeSaveFailure(result.reason));
  }

  function announce(message: string): void {
    liveStatus.textContent = message;
  }

  const visibleTasks = (): Task[] => queryTasks(tasks, filter, searchQuery);

  const taskControl = (id: number): HTMLElement | null => {
    const box = stageEl.querySelector<HTMLElement>(`[data-task-id="${id}"]:not([data-exiting="true"])`);
    if (box && !orbitalView.hidden) return box;
    return listEl.querySelector<HTMLElement>(`[data-task-id="${id}"]:not([data-exiting="true"]) [data-action="open"]`);
  };

  const listControl = (id: number, action: 'toggle' | 'open' | 'edit' | 'delete'): HTMLElement | null =>
    listEl.querySelector<HTMLElement>(`[data-task-id="${id}"]:not([data-exiting="true"]) [data-action="${action}"]`);

  const visibleAddButton = (): HTMLButtonElement => (tasks.length === 0 ? emptyAdd : headerAdd);

  const fallbackFocus = (): HTMLElement => {
    if (tasks.length === 0) return emptyAdd;
    if (filter === 'all' && normalizeSearchQuery(searchQuery) !== '') return searchInput;
    return filterButton(filterBar, filter);
  };

  type RenderReason = 'init' | 'search' | 'filter' | 'add' | 'status' | 'edit' | 'delete-complete' | 'view';

  interface RenderContext {
    reason?: RenderReason;
    taskId?: number;
    prevView?: ViewMode;
    prevRects?: Map<number, RectLike>;
    pageChanged?: boolean;
  }

  let nodeGenCounter = 0;
  const orbitExitTimers = new Map<HTMLElement, number>();
  const deleteCoordinator = createDeleteCoordinator();

  function ensureListRowVisible(container: HTMLElement, row: HTMLElement): void {
    const bounds = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (bounds.height <= 0 || rect.height <= 0) return;
    if (rect.bottom > bounds.bottom) {
      container.scrollTop += rect.bottom - bounds.bottom + 16;
    } else if (rect.top < bounds.top) {
      container.scrollTop -= bounds.top - rect.top + 16;
    }
  }

  function captureVisibleListRects(): Map<number, RectLike> {
    const rects = new Map<number, RectLike>();
    if (listView.hidden) return rects;
    const bounds = listView.getBoundingClientRect();
    for (const row of Array.from(listEl.querySelectorAll<HTMLElement>('.list-row[data-task-id]:not([data-exiting="true"])'))) {
      const id = Number(row.dataset.taskId);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const rect = row.getBoundingClientRect();
      if (intersectsViewport(rect, bounds)) {
        rects.set(id, rect);
      }
    }
    return rects;
  }

  function captureActiveOrbitRects(): Map<number, RectLike> {
    const rects = new Map<number, RectLike>();
    if (orbitalView.hidden) return rects;
    const bounds = stageEl.getBoundingClientRect();
    for (const box of Array.from(stageEl.querySelectorAll<HTMLElement>('.task-box[data-task-id]:not([data-exiting="true"])'))) {
      const id = Number(box.dataset.taskId);
      const printEl = box.querySelector<HTMLElement>('.box-print');
      if (!Number.isSafeInteger(id) || id <= 0 || !printEl) continue;
      const rect = printEl.getBoundingClientRect();
      if (intersectsViewport(rect, bounds)) {
        rects.set(id, rect);
      }
    }
    return rects;
  }

  const nextGen = (el: HTMLElement): string => {
    const gen = String(++nodeGenCounter);
    el.dataset.motionGen = gen;
    return gen;
  };

  const clearOrbitExitTimer = (el: HTMLElement): void => {
    const timerId = orbitExitTimers.get(el);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      orbitExitTimers.delete(el);
    }
  };

  function flushExitingOrbitNodes(): void {
    cancelMotionGroup('orbit-exit');
    for (const timerId of orbitExitTimers.values()) {
      window.clearTimeout(timerId);
    }
    orbitExitTimers.clear();
    for (const el of Array.from(stageEl.querySelectorAll('[data-exiting="true"]'))) {
      el.remove();
    }
  }

  bindBridgeCancellation(document);
  registerTransitionFlush(() => deleteCoordinator.flush(false));
  registerTransitionFlush(() => flushExitingOrbitNodes());
  registerTransitionFlush(() => {
    window.clearTimeout(searchAnnounceTimer);
    searchAnnounceTimer = 0;
  });
  registerTransitionFlush(() => {
    if (readerDialog.isOpen()) readerDialog.close(false);
  });

  function resolveReaderSource(taskId: number): HTMLElement | null {
    if (!Number.isSafeInteger(taskId) || taskId <= 0) return null;
    if (!orbitalView.hidden) {
      const box = stageEl.querySelector<HTMLElement>(
        `.task-box[data-task-id="${taskId}"]:not([data-exiting="true"])`,
      );
      const target = box?.querySelector<HTMLElement>('.box-print') ?? box ?? null;
      if (!target || target.hidden) return null;
      return intersectsViewport(target.getBoundingClientRect(), stageEl.getBoundingClientRect())
        ? target
        : null;
    }
    if (!listView.hidden) {
      const row = listEl.querySelector<HTMLElement>(
        `.list-row[data-task-id="${taskId}"]:not([data-exiting="true"])`,
      );
      if (!row || row.hidden) return null;
      return intersectsViewport(row.getBoundingClientRect(), listView.getBoundingClientRect())
        ? row
        : null;
    }
    return null;
  }

  const readerDialog = initReaderDialog(document, {
    onToggle(id) {
      handleToggle(id, true);
    },
    onEdit(task, returnFocus) {
      dialog.openEdit(task, returnFocus);
    },
    onDelete(task, returnFocus) {
      openDeleteFor(task, returnFocus);
    },
    getSourceElement: resolveReaderSource,
  });

  const stage = createOrbitalStage(stageEl, {
    onSelectTask(id) {
      readerDialog.open(id, visibleTasks(), tasks, () => taskControl(id) ?? fallbackFocus(), new Date());
    },
    onPauseChange(paused) {
      syncPauseButton(paused);
    },
  });

  function syncPauseButton(paused: boolean): void {
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? '▷' : 'Ⅱ';
    pauseBtn.setAttribute('aria-label', paused ? 'Lanjutkan gerak orbital' : 'Jeda gerak orbital');
  }

  function render(context: RenderContext = {}): void {
    const reason: RenderReason = context.reason ?? 'init';
    const visible = visibleTasks();
    const today = new Date();
    const hasAny = tasks.length > 0;
    const hasVisible = visible.length > 0;
    const effectiveView: ViewMode = resolveEffectiveView(visible.length, selectedView);

    emptyState.hidden = hasAny;
    filterEmpty.hidden = !(hasAny && !hasVisible);
    utilityBar.hidden = !hasAny;
    headerAdd.hidden = !hasAny;
    searchClear.hidden = searchQuery === '';

    renderFilterBar(filterBar, tasks, filter);
    renderSummary(summaryEl, tasks);

    viewOrbitBtn.setAttribute('aria-pressed', String(effectiveView === 'orbit'));
    viewListBtn.setAttribute('aria-pressed', String(effectiveView === 'list'));

    if (!hasVisible) {
      flushExitingOrbitNodes();
      cancelMotionGroup('orbit-enter');
      cancelMotionGroup('list-stagger');
      cancelMotionGroup('list-reflow');
      cancelMotionGroup('view-switch');
      orbitalView.hidden = true;
      listView.hidden = true;
      viewNotice.hidden = true;
      orbitPager.hidden = true;
      pauseBtn.hidden = true;
      stage.setActive(false);

      if (hasAny) {
        const hasFilter = filter !== 'all';
        const hasQuery = normalizeSearchQuery(searchQuery) !== '';
        if (hasFilter && hasQuery) {
          filterEmptyEyebrow.textContent = 'FILTER & PENCARIAN';
          filterEmptyTitle.textContent = 'Tidak ada tugas yang cocok.';
          filterEmptyHint.textContent = 'Tidak ditemukan tugas pada filter status dan kata kunci ini.';
          showAll.textContent = 'Reset filter & pencarian';
        } else if (hasQuery) {
          filterEmptyEyebrow.textContent = 'PENCARIAN KOSONG';
          filterEmptyTitle.textContent = 'Tidak ada tugas yang cocok.';
          filterEmptyHint.textContent = 'Coba kata kunci lain atau hapus pencarian untuk melihat semua tugas.';
          showAll.textContent = 'Hapus pencarian';
        } else {
          filterEmptyEyebrow.textContent = 'FILTER AKTIF';
          filterEmptyTitle.textContent = 'Tidak ada tugas pada filter ini.';
          filterEmptyHint.textContent = 'Ubah filter di bilah atas atau tampilkan kembali seluruh tugas.';
          showAll.textContent = 'Tampilkan semua';
        }
      }

      renderRangeIndex(rangeIndex, 0, 0, 0, tasks);
      readerDialog.refresh(visible, tasks, today);
      return;
    }

    if (effectiveView === 'orbit') {
      const pageData = paginateOrbit(visible, orbitPage, ORBIT_LIMIT);
      orbitPage = pageData.page;
      const wasOrbitVisible = !orbitalView.hidden;
      const isViewSwitch = canAnimate() && reason === 'view' && context.prevView === 'list' && !wasOrbitVisible;

      listView.hidden = true;
      orbitalView.hidden = false;
      viewNotice.hidden = true;
      cancelMotionGroup('list-stagger');
      cancelMotionGroup('list-reflow');
      cancelMotionGroup('view-switch');

      const animateFilterWave = !isViewSwitch && canAnimate() && (reason === 'filter' || reason === 'search');
      const animateAdd = !isViewSwitch && canAnimate() && reason === 'add';
      const animateReflow =
        !isViewSwitch &&
        !context.pageChanged &&
        wasOrbitVisible &&
        canAnimate() &&
        (reason === 'filter' || reason === 'search' || reason === 'add' || reason === 'status' || reason === 'delete-complete');

      if (!animateFilterWave) {
        flushExitingOrbitNodes();
      }
      if (reason === 'filter' || reason === 'search' || reason === 'view') {
        cancelMotionGroup('orbit-enter');
      }

      const diff = reconcileOrbitalStage(
        stageEl,
        boxTemplate,
        pageData.items,
        pageData.startIndex,
        today,
        !animateFilterWave,
      );

      for (const pair of diff.restored) {
        clearOrbitExitTimer(pair.box);
        nextGen(pair.box);
        const printEl = pair.box.querySelector<HTMLElement>('.box-print');
        if (printEl && typeof printEl.getAnimations === 'function') {
          for (const anim of printEl.getAnimations()) anim.cancel();
        }
        if (typeof pair.caption.getAnimations === 'function') {
          for (const anim of pair.caption.getAnimations()) anim.cancel();
        }
      }

      stage.setActive(true);
      stage.sync({ animateReflow });

      if (isViewSwitch) {
        const activePairs = [...diff.entered, ...diff.updated, ...diff.restored];
        const stageBounds = stageEl.getBoundingClientRect();
        const prevRects = context.prevRects;
        const viewSwitchPlan = activePairs.map((pair) => {
          const printEl = pair.box.querySelector<HTMLElement>('.box-print');
          const boxRect = pair.box.getBoundingClientRect();
          const lastRect = printEl?.getBoundingClientRect() ?? null;
          const parentScaleX = pair.box.offsetWidth > 0 ? boxRect.width / pair.box.offsetWidth : 1;
          const parentScaleY = pair.box.offsetHeight > 0 ? boxRect.height / pair.box.offsetHeight : 1;
          const firstRect = prevRects?.get(pair.id) ?? null;
          const visibleOnStage = lastRect !== null && intersectsViewport(lastRect, stageBounds);
          return {
            pair,
            printEl,
            lastRect,
            parentScaleX,
            parentScaleY,
            firstRect,
            visibleOnStage,
          };
        });

        let unpairedCount = 0;
        for (const item of viewSwitchPlan) {
          if (!item.printEl || !item.lastRect || !item.visibleOnStage) continue;
          nextGen(item.pair.box);
          if (item.firstRect) {
            const delta = computeFlipDelta(item.firstRect, item.lastRect, {
              parentScaleX: item.parentScaleX,
              parentScaleY: item.parentScaleY,
              includeScale: true,
              minScale: 0.45,
              maxScale: 1.85,
            });
            if (delta.moved || delta.scaled) {
              animateElement(
                'view-switch',
                item.printEl,
                [
                  {
                    transform: `translate3d(${delta.tx.toFixed(2)}px, ${delta.ty.toFixed(2)}px, 0) scale(${delta.sx.toFixed(3)}, ${delta.sy.toFixed(3)})`,
                    opacity: 0.72,
                  },
                  {
                    transform: 'translate3d(0, 0, 0) scale(1, 1)',
                    opacity: 1,
                  },
                ],
                { duration: 300, easing: EASE_OUT, fill: 'backwards' },
              );
              animateElement(
                'view-switch',
                item.pair.caption,
                [{ opacity: 0 }, { opacity: 1 }],
                { duration: 180, delay: 90, easing: EASE_OUT, fill: 'backwards' },
              );
              continue;
            }
          }

          if (unpairedCount < STAGGER_MAX_ITEMS) {
            const delay = unpairedCount * 16;
            unpairedCount += 1;
            animateElement(
              'view-switch',
              item.printEl,
              [
                { transform: 'scale(0.94)', opacity: 0 },
                { transform: 'scale(1)', opacity: 1 },
              ],
              { duration: 220, delay, easing: EASE_OUT, fill: 'backwards' },
            );
            animateElement(
              'view-switch',
              item.pair.caption,
              [{ opacity: 0 }, { opacity: 1 }],
              { duration: 180, delay: delay + 40, easing: EASE_OUT, fill: 'backwards' },
            );
          }
        }
      } else if (animateFilterWave) {
        const isSearch = reason === 'search';
        const stepMs = isSearch ? 0 : STAGGER_STEP_MS;
        const exitDuration = isSearch ? 140 : 180;
        const captionExitDuration = isSearch ? 110 : 140;
        const enterDuration = isSearch ? 180 : 240;
        const captionEnterDuration = isSearch ? 150 : 200;

        const exitDelays = computeStaggerDelays(diff.exiting.length, stepMs, STAGGER_MAX_ITEMS);
        diff.exiting.forEach((pair, idx) => {
          const delay = exitDelays[idx];
          if (delay === null || delay === undefined) {
            clearOrbitExitTimer(pair.box);
            pair.box.remove();
            pair.caption.remove();
            return;
          }
          const gen = nextGen(pair.box);
          const printEl = pair.box.querySelector<HTMLElement>('.box-print');
          const cleanup = (): void => {
            if (pair.box.dataset.exiting !== 'true' || pair.box.dataset.motionGen !== gen) return;
            clearOrbitExitTimer(pair.box);
            pair.box.remove();
            pair.caption.remove();
          };
          const anim = animateElement(
            'orbit-exit',
            printEl,
            [
              { transform: 'scale(1)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
              { transform: 'scale(0.92)', opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            ],
            { duration: exitDuration, delay, easing: EASE_EXIT, fill: 'forwards' },
          );
          animateElement(
            'orbit-exit',
            pair.caption,
            [
              { opacity: 1, clipPath: 'inset(0 0 0 0)' },
              { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            ],
            { duration: captionExitDuration, delay, easing: EASE_EXIT, fill: 'forwards' },
          );
          if (!anim) {
            cleanup();
            return;
          }
          const timerId = window.setTimeout(cleanup, exitDuration + delay + 140);
          orbitExitTimers.set(pair.box, timerId);
          void Promise.resolve(anim.finished).then(cleanup, () => {});
        });

        const enteringPairs = [...diff.entered, ...diff.restored];
        const enterDelays = computeStaggerDelays(enteringPairs.length, stepMs, STAGGER_MAX_ITEMS);
        enteringPairs.forEach((pair, idx) => {
          const delay = enterDelays[idx];
          if (delay === null || delay === undefined) return;
          nextGen(pair.box);
          const printEl = pair.box.querySelector<HTMLElement>('.box-print');
          animateElement(
            'orbit-enter',
            printEl,
            [
              { transform: 'scale(0.94)', opacity: 0, clipPath: 'inset(100% 0 0 0)' },
              { transform: 'scale(1)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
            ],
            { duration: enterDuration, delay, easing: EASE_OUT, fill: 'backwards' },
          );
          animateElement(
            'orbit-enter',
            pair.caption,
            [
              { opacity: 0, clipPath: 'inset(100% 0 0 0)' },
              { opacity: 1, clipPath: 'inset(0 0 0 0)' },
            ],
            { duration: captionEnterDuration, delay, easing: EASE_OUT, fill: 'backwards' },
          );
        });
      } else if (animateAdd && context.taskId !== undefined) {
        const added = diff.entered.find((pair) => pair.id === context.taskId);
        const printEl = added?.box.querySelector<HTMLElement>('.box-print');
        if (printEl && added) {
          animateElement(
            'add',
            printEl,
            [
              { transform: 'translate3d(0, 14px, 0) scale(0.88)', opacity: 0 },
              { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
            ],
            { duration: 300, easing: EASE_OUT, fill: 'backwards' },
          );
          animateElement(
            'add',
            added.caption,
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: 200, delay: 90, easing: EASE_OUT, fill: 'backwards' },
          );
        }
      }

      orbitPager.hidden = pageData.totalPages <= 1;
      orbitPageLabel.textContent = `Hal ${pageData.page} / ${pageData.totalPages}`;
      orbitPrev.disabled = pageData.page <= 1;
      orbitNext.disabled = pageData.page >= pageData.totalPages;

      pauseBtn.hidden = pageData.items.length <= 1;
      syncPauseButton(stage.isPaused());
      renderRangeIndex(rangeIndex, pageData.startIndex, pageData.endIndex, visible.length, tasks);
    } else {
      const wasListVisible = !listView.hidden;
      const isViewSwitch = canAnimate() && reason === 'view' && context.prevView === 'orbit' && !wasListVisible;
      const shouldFlipReflow = canAnimate() && wasListVisible && reason !== 'init' && reason !== 'view';
      const prevListRects = shouldFlipReflow ? captureVisibleListRects() : new Map<number, RectLike>();

      flushExitingOrbitNodes();
      cancelMotionGroup('orbit-enter');
      cancelMotionGroup('view-switch');
      cancelMotionGroup('list-reflow');
      cancelMotionGroup('list-stagger');
      stage.setActive(false);
      orbitalView.hidden = true;
      listView.hidden = false;
      orbitPager.hidden = true;
      pauseBtn.hidden = true;
      viewNotice.hidden = true;
      void viewNoticeText;

      const listDiff = reconcileAccessibleList(listEl, rowTemplate, visible, today);
      const addedEntry =
        reason === 'add' && context.taskId !== undefined
          ? listDiff.entered.find((entry) => entry.id === context.taskId)
          : undefined;

      if (isViewSwitch) {
        const listBounds = listView.getBoundingClientRect();
        const prevRects = context.prevRects;
        const entries = [...listDiff.entered, ...listDiff.updated].map((entry) => {
          const lastRect = entry.row.getBoundingClientRect();
          return {
            entry,
            lastRect,
            firstRect: prevRects?.get(entry.id) ?? null,
            isVisible: intersectsViewport(lastRect, listBounds),
          };
        });

        let unpairedCount = 0;
        for (const item of entries) {
          if (!item.isVisible) continue;
          if (item.firstRect) {
            const delta = computeFlipDelta(item.firstRect, item.lastRect, {
              includeScale: true,
              minScale: 0.45,
              maxScale: 1.85,
            });
            if (delta.moved || delta.scaled) {
              animateElement(
                'view-switch',
                item.entry.row,
                [
                  {
                    transform: `translate3d(${delta.tx.toFixed(2)}px, ${delta.ty.toFixed(2)}px, 0) scale(${delta.sx.toFixed(3)}, ${delta.sy.toFixed(3)})`,
                    opacity: 0.72,
                  },
                  {
                    transform: 'translate3d(0, 0, 0) scale(1, 1)',
                    opacity: 1,
                  },
                ],
                { duration: 300, easing: EASE_OUT, fill: 'backwards' },
              );
              continue;
            }
          }

          if (unpairedCount < STAGGER_MAX_ITEMS) {
            const delay = unpairedCount * 16;
            unpairedCount += 1;
            animateElement(
              'view-switch',
              item.entry.row,
              [
                { transform: 'translate3d(0, 8px, 0)', opacity: 0 },
                { transform: 'translate3d(0, 0, 0)', opacity: 1 },
              ],
              { duration: 200, delay, easing: EASE_OUT, fill: 'backwards' },
            );
          }
        }
      } else {
        const canRunMotion = canAnimate();
        const listBounds = listView.getBoundingClientRect();
        const reflowTargets: Array<{ row: HTMLElement; tx: number; ty: number }> = [];

        if (canRunMotion && shouldFlipReflow && prevListRects.size > 0) {
          for (const entry of listDiff.updated) {
            const firstRect = prevListRects.get(entry.id);
            if (!firstRect) continue;
            const lastRect = entry.row.getBoundingClientRect();
            if (!intersectsViewport(firstRect, listBounds) && !intersectsViewport(lastRect, listBounds)) {
              continue;
            }
            const delta = computeFlipDelta(firstRect, lastRect, { includeScale: false });
            if (delta.moved) {
              reflowTargets.push({ row: entry.row, tx: delta.tx, ty: delta.ty });
            }
          }
        }

        if (addedEntry && wasListVisible) {
          ensureListRowVisible(listView, addedEntry.row);
        }

        if (canRunMotion) {
          const enteringVisible: Array<{ id: number; row: HTMLElement }> = [];
          if (reason === 'filter' || reason === 'search') {
            for (const entry of listDiff.entered) {
              const rect = entry.row.getBoundingClientRect();
              if (intersectsViewport(rect, listBounds)) {
                enteringVisible.push(entry);
              }
            }
          }

          const reflowDuration = reason === 'search' ? 160 : 220;
          for (const item of reflowTargets) {
            animateElement(
              'list-reflow',
              item.row,
              [
                { transform: `translate3d(${item.tx.toFixed(2)}px, ${item.ty.toFixed(2)}px, 0)` },
                { transform: 'translate3d(0, 0, 0)' },
              ],
              { duration: reflowDuration, easing: EASE_OUT, fill: 'none' },
            );
          }

          if (addedEntry) {
            animateElement(
              'add',
              addedEntry.row,
              [
                { transform: 'translate3d(0, 12px, 0) scale(0.975)', opacity: 0 },
                { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
              ],
              { duration: 280, easing: EASE_OUT, fill: 'backwards' },
            );
          } else if (reason === 'search') {
            enteringVisible.slice(0, STAGGER_MAX_ITEMS).forEach((entry) => {
              animateElement(
                'list-stagger',
                entry.row,
                [
                  { transform: 'translate3d(0, 6px, 0)', opacity: 0 },
                  { transform: 'translate3d(0, 0, 0)', opacity: 1 },
                ],
                { duration: 160, easing: EASE_OUT, fill: 'backwards' },
              );
            });
          } else if (reason === 'filter') {
            const delays = computeStaggerDelays(enteringVisible.length, STAGGER_STEP_MS, STAGGER_MAX_ITEMS);
            enteringVisible.forEach((entry, idx) => {
              const delay = delays[idx];
              if (delay === null || delay === undefined) return;
              animateElement(
                'list-stagger',
                entry.row,
                [
                  { transform: 'translate3d(0, 8px, 0)', opacity: 0 },
                  { transform: 'translate3d(0, 0, 0)', opacity: 1 },
                ],
                { duration: 200, delay, easing: EASE_OUT, fill: 'backwards' },
              );
            });
          }
        }
      }

      renderRangeIndex(rangeIndex, 1, visible.length, visible.length, tasks);
    }

    readerDialog.refresh(visible, tasks, today);
  }

  function setViewMode(mode: ViewMode): void {
    deleteCoordinator.flush(false);
    const prevEffective = resolveEffectiveView(visibleTasks().length, selectedView);
    let prevView: ViewMode | undefined;
    let prevRects: Map<number, RectLike> | undefined;

    if (mode !== prevEffective && canAnimate()) {
      if (prevEffective === 'list' && !listView.hidden) {
        prevView = 'list';
        prevRects = captureVisibleListRects();
      } else if (prevEffective === 'orbit' && !orbitalView.hidden) {
        prevView = 'orbit';
        prevRects = captureActiveOrbitRects();
      }
    }

    savedPreference = mode;
    selectedView = mode;
    saveViewMode(storage, mode);
    orbitPage = 1;
    render({ reason: 'view', prevView, prevRects });
    announce(mode === 'orbit' ? 'Menampilkan mode Orbit.' : 'Menampilkan mode Daftar.');
  }

  const dialog = initTaskDialog(document, {
    onCreate(draft) {
      deleteCoordinator.flush(false);
      tasks = createTask(tasks, draft);
      persist();
      const created = tasks[tasks.length - 1];
      const visible = visibleTasks();
      const effectiveView = resolveEffectiveView(visible.length, selectedView);
      const prevOrbitPage = orbitPage;
      if (effectiveView === 'orbit' && visible.length > ORBIT_LIMIT) {
        orbitPage = Math.ceil(visible.length / ORBIT_LIMIT);
      }
      render({ reason: 'add', taskId: created?.id, pageChanged: orbitPage !== prevOrbitPage });
      const shown = created !== undefined && visible.some((item) => item.id === created.id);
      if (!shown) {
        announce('Tugas baru ditambahkan, tetapi tidak tampil pada filter atau pencarian aktif.');
      } else {
        announce('Tugas baru ditambahkan.');
      }
    },
    onEdit(id, draft) {
      deleteCoordinator.flush(false);
      const before = tasks.find((task) => task.id === id);
      tasks = updateTask(tasks, id, draft);
      const unchanged =
        before !== undefined &&
        before.title === draft.title &&
        before.course === draft.course &&
        (before.category ?? '') === (draft.category ?? '') &&
        (before.description ?? '') === (draft.description ?? '') &&
        before.deadline === draft.deadline;
      if (!unchanged) persist();
      render({ reason: 'edit', taskId: id });
      announce('Tugas diperbarui.');
    },
  });

  const deleteDialog = initDeleteDialog(document, (id) => {
    if (!tasks.some((task) => task.id === id)) return;
    const next = survivorId(visibleTasks(), id);
    const fromReader = readerDialog.isOpen();
    if (fromReader) readerDialog.close(false);

    const targetBox = !orbitalView.hidden
      ? stageEl.querySelector<HTMLButtonElement>(`.task-box[data-task-id="${id}"]:not([data-exiting="true"])`)
      : null;
    const targetCaption = targetBox
      ? stageEl.querySelector<HTMLElement>(`.box-caption[data-caption-for="${id}"]:not([data-exiting="true"])`)
      : null;
    const targetRow = !listView.hidden
      ? listEl.querySelector<HTMLElement>(`.list-row[data-task-id="${id}"]:not([data-exiting="true"])`)
      : null;
    const hasDomTarget = (targetBox !== null || targetRow !== null) && canAnimate();

    deleteCoordinator.start({
      persist() {
        tasks = removeTask(tasks, id);
        persist();
      },
      hasTarget: hasDomTarget,
      runExitAnimation(onComplete) {
        if (targetBox) {
          targetBox.dataset.exiting = 'true';
          targetBox.setAttribute('aria-hidden', 'true');
          targetBox.setAttribute('inert', '');
          targetBox.disabled = true;
          targetBox.tabIndex = -1;
          if (targetCaption) {
            targetCaption.dataset.exiting = 'true';
            targetCaption.setAttribute('inert', '');
          }
          const printEl = targetBox.querySelector<HTMLElement>('.box-print');
          const anim = animateElement(
            'delete-exit',
            printEl,
            [
              { transform: 'scale(1)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
              { transform: 'scale(0.92)', opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            ],
            { duration: 180, easing: EASE_EXIT, fill: 'forwards' },
          );
          animateElement(
            'delete-exit',
            targetCaption,
            [
              { opacity: 1, clipPath: 'inset(0 0 0 0)' },
              { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            ],
            { duration: 140, easing: EASE_EXIT, fill: 'forwards' },
          );
          if (!anim) return null;
          void Promise.resolve(anim.finished).then(onComplete, () => {});
          return () => cancelMotionGroup('delete-exit');
        }
        if (targetRow) {
          targetRow.dataset.exiting = 'true';
          targetRow.setAttribute('aria-hidden', 'true');
          targetRow.setAttribute('inert', '');
          for (const focusable of Array.from(targetRow.querySelectorAll<HTMLElement>('button, input'))) {
            focusable.tabIndex = -1;
          }
          const anim = animateElement(
            'delete-exit',
            targetRow,
            [
              { transform: 'scale(1)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
              { transform: 'scale(0.92)', opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            ],
            { duration: 180, easing: EASE_EXIT, fill: 'forwards' },
          );
          if (!anim) return null;
          void Promise.resolve(anim.finished).then(onComplete, () => {});
          return () => cancelMotionGroup('delete-exit');
        }
        return null;
      },
      render() {
        flushExitingOrbitNodes();
        render({ reason: 'delete-complete' });
      },
      restoreFocus() {
        if (document.querySelector('dialog[open]') !== null) return;
        const active = document.activeElement;
        const userMovedFocus =
          active instanceof HTMLElement &&
          active !== document.body &&
          active !== document.documentElement &&
          active.dataset.exiting !== 'true' &&
          !active.closest('[data-exiting="true"]');
        if (userMovedFocus) return;
        ((next !== null ? taskControl(next) : null) ?? fallbackFocus()).focus();
      },
      announce() {
        announce('Tugas dihapus.');
      },
    });
  });

  function openDeleteFor(task: Task, cancelFocus: () => HTMLElement | null): void {
    deleteCoordinator.flush(false);
    deleteDialog.open(task, (deleted) => {
      if (!deleted) return cancelFocus() ?? fallbackFocus();
      return null;
    });
  }

  function handleToggle(id: number, fromReader: boolean): void {
    deleteCoordinator.flush(false);
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const prevRange = rangeIndex.textContent ?? '';
    const next = survivorId(visibleTasks(), id);
    tasks = toggleStatus(tasks, id);
    persist();
    render({ reason: 'status', taskId: id });

    const message = task.status === 'selesai' ? 'Ditandai belum selesai.' : 'Ditandai selesai.';
    if (fromReader) {
      announce(message);
      readerDialog.pulseStatus();
      if (rangeIndex.textContent !== prevRange) {
        animateElement('status', rangeIndex, [{ opacity: 0.55 }, { opacity: 1 }], {
          duration: 180,
          easing: EASE_OUT,
          fill: 'none',
        });
      }
      return;
    }

    const stillVisible = listControl(id, 'toggle');
    if (stillVisible) {
      stillVisible.focus();
      announce(message);
      const row = stillVisible.closest<HTMLElement>('.list-row');
      const statusBadge = row?.querySelector<HTMLElement>('.list-status') ?? null;
      animateElement(
        'status',
        statusBadge,
        [
          { transform: 'translate3d(0, 4px, 0)', opacity: 0.55 },
          { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        ],
        { duration: 180, easing: EASE_OUT, fill: 'none' },
      );
      animateElement(
        'status',
        stillVisible,
        [{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
        { duration: 180, easing: EASE_OUT, fill: 'none' },
      );
    } else {
      const neighbour = next === null ? null : listControl(next, 'toggle');
      (neighbour ?? fallbackFocus()).focus();
      announce(`${message} Tugas tidak tampil pada filter ${FILTER_LABELS[filter]}.`);
    }

    if (rangeIndex.textContent !== prevRange) {
      animateElement('status', rangeIndex, [{ opacity: 0.55 }, { opacity: 1 }], {
        duration: 180,
        easing: EASE_OUT,
        fill: 'none',
      });
    }
  }

  emptyAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));
  headerAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));

  filterBar.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const value = target?.closest<HTMLElement>('[data-filter]')?.dataset.filter;
    if (!isTaskFilter(value) || value === filter) return;
    deleteCoordinator.flush(false);
    filter = value;
    orbitPage = 1;
    render({ reason: 'filter' });
    const visibleCount = visibleTasks().length;
    const suffix = normalizeSearchQuery(searchQuery) !== '' ? ' untuk pencarian aktif' : '';
    announce(`Menampilkan ${FILTER_LABELS[filter]}${suffix}: ${visibleCount} tugas.`);
  });

  searchInput.addEventListener('input', () => {
    deleteCoordinator.flush(false);
    searchQuery = searchInput.value;
    orbitPage = 1;
    render({ reason: 'search' });
    window.clearTimeout(searchAnnounceTimer);
    searchAnnounceTimer = window.setTimeout(() => {
      const count = visibleTasks().length;
      if (normalizeSearchQuery(searchQuery) === '') {
        announce(`Pencarian dihapus. Menampilkan ${count} tugas.`);
      } else {
        announce(`Ditemukan ${count} tugas.`);
      }
    }, 300);
  });

  searchClear.addEventListener('click', () => {
    deleteCoordinator.flush(false);
    window.clearTimeout(searchAnnounceTimer);
    searchQuery = '';
    searchInput.value = '';
    orbitPage = 1;
    render({ reason: 'search' });
    searchInput.focus();
    announce(`Pencarian dihapus. Menampilkan ${visibleTasks().length} tugas.`);
  });

  showAll.addEventListener('click', () => {
    deleteCoordinator.flush(false);
    window.clearTimeout(searchAnnounceTimer);
    const hasFilter = filter !== 'all';
    const hasQuery = normalizeSearchQuery(searchQuery) !== '';
    if (hasFilter && hasQuery) {
      filter = 'all';
      searchQuery = '';
      searchInput.value = '';
      orbitPage = 1;
      render({ reason: 'filter' });
      searchInput.focus();
      announce(`Filter dan pencarian direset. Menampilkan ${tasks.length} tugas.`);
    } else if (hasQuery) {
      searchQuery = '';
      searchInput.value = '';
      orbitPage = 1;
      render({ reason: 'filter' });
      searchInput.focus();
      announce(`Pencarian dihapus. Menampilkan ${visibleTasks().length} tugas.`);
    } else {
      filter = 'all';
      orbitPage = 1;
      render({ reason: 'filter' });
      filterButton(filterBar, 'all').focus();
      announce(`Menampilkan semua: ${tasks.length} tugas.`);
    }
  });

  viewOrbitBtn.addEventListener('click', () => setViewMode('orbit'));
  viewListBtn.addEventListener('click', () => setViewMode('list'));
  viewOrbitForce.addEventListener('click', () => setViewMode('orbit'));

  pauseBtn.addEventListener('click', () => {
    const nextPaused = !stage.isPaused();
    stage.setPaused(nextPaused);
    announce(nextPaused ? 'Gerak orbital dijeda.' : 'Gerak orbital dilanjutkan.');
  });

  orbitPrev.addEventListener('click', () => {
    if (orbitPage <= 1) return;
    deleteCoordinator.flush(false);
    orbitPage -= 1;
    render({ reason: 'filter' });
    announce(`Menampilkan halaman orbital ${orbitPage}.`);
  });

  orbitNext.addEventListener('click', () => {
    deleteCoordinator.flush(false);
    orbitPage += 1;
    render({ reason: 'filter' });
    announce(`Menampilkan halaman orbital ${orbitPage}.`);
  });

  const taskFromList = (element: Element | null): Task | undefined => {
    const id = Number(element?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId);
    return tasks.find((item) => item.id === id);
  };

  listEl.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const openBtn = target?.closest('[data-action="open"]') ?? null;
    const editBtn = target?.closest('[data-action="edit"]') ?? null;
    const deleteBtn = target?.closest('[data-action="delete"]') ?? null;
    const task = taskFromList(openBtn ?? editBtn ?? deleteBtn);
    if (!task) return;

    if (openBtn) {
      readerDialog.open(task.id, visibleTasks(), tasks, () => listControl(task.id, 'open') ?? fallbackFocus(), new Date());
    } else if (editBtn) {
      dialog.openEdit(task, () => listControl(task.id, 'edit') ?? visibleAddButton());
    } else if (deleteBtn) {
      openDeleteFor(task, () => listControl(task.id, 'delete'));
    }
  });

  listEl.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.matches('[data-action="toggle"]')) return;
    const task = taskFromList(target);
    if (!task) return;
    handleToggle(task.id, false);
  });

  showNotice(notice);
  render();
} finally {
  // The shell is in the DOM and initialisation has run: allow the incoming route transition to enter.
  // Called in `finally` so a failed init can never leave the page stuck in the transition pre-state.
  bridge.markPageReady();
}
