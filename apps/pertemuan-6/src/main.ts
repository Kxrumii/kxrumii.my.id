import { bridge } from './transition.ts';
import './style.css';
import { FILTER_LABELS, filterCounts, filterTasks, isTaskFilter, type TaskFilter } from './filters.ts';
import { ORBIT_LIMIT, createOrbitalStage, paginateOrbit, resolveEffectiveView } from './orbital-stage.ts';
import { initReaderDialog } from './reader-dialog.ts';
import {
  filterButton,
  renderAccessibleList,
  renderFilterBar,
  renderOrbitalStage,
  renderRangeIndex,
  renderSummary,
  requireElement,
} from './render.ts';
import { initThemeToggle } from './theme.ts';
import { initDeleteDialog } from './delete-dialog.ts';
import { initTaskDialog } from './task-dialog.ts';
import { describeLoad, describeSaveFailure, getBrowserStorage, loadTasks, saveTasks } from './storage.ts';
import { createTask, removeTask, survivorId, toggleStatus, updateTask } from './tasks.ts';
import type { Task, ViewMode, ViewPreference } from './types.ts';

const appName: string = import.meta.env.VITE_APP_NAME || 'College Task Manager';

// State dipulihkan dari localStorage (divalidasi) sebelum render pertama; bila gagal, mulai kosong di memori.
let tasks: Task[] = [];
// Filter dan preferensi tampilan bersifat sementara per sesi.
let filter: TaskFilter = 'all';
let viewPreference: ViewPreference = 'auto';
let orbitPage = 1;

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
  const emptyAdd = requireElement(document, '#add-task-button', HTMLButtonElement);
  const headerAdd = requireElement(document, '#add-task-header', HTMLButtonElement);
  const showAll = requireElement(document, '#show-all-button', HTMLButtonElement);

  const filterBar = requireElement(document, '#filter-bar', HTMLElement);
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

  const visibleTasks = (): Task[] => filterTasks(tasks, filter);

  const taskControl = (id: number): HTMLElement | null => {
    const box = stageEl.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
    if (box && !orbitalView.hidden) return box;
    return listEl.querySelector<HTMLElement>(`[data-task-id="${id}"] [data-action="open"]`);
  };

  const listControl = (id: number, action: 'toggle' | 'open' | 'edit' | 'delete'): HTMLElement | null =>
    listEl.querySelector<HTMLElement>(`[data-task-id="${id}"] [data-action="${action}"]`);

  const visibleAddButton = (): HTMLButtonElement => (tasks.length === 0 ? emptyAdd : headerAdd);

  const fallbackFocus = (): HTMLElement =>
    tasks.length === 0 ? emptyAdd : filterButton(filterBar, filter);

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

  function render(): void {
    const visible = visibleTasks();
    const today = new Date();
    const hasAny = tasks.length > 0;
    const hasVisible = visible.length > 0;
    const effectiveView = resolveEffectiveView(visible.length, viewPreference);

    emptyState.hidden = hasAny;
    filterEmpty.hidden = !(hasAny && !hasVisible);
    filterBar.hidden = !hasAny;
    headerAdd.hidden = !hasAny;

    renderFilterBar(filterBar, tasks, filter);
    renderSummary(summaryEl, tasks);

    viewOrbitBtn.setAttribute('aria-pressed', String(effectiveView === 'orbit'));
    viewListBtn.setAttribute('aria-pressed', String(effectiveView === 'list'));

    if (!hasVisible) {
      orbitalView.hidden = true;
      listView.hidden = true;
      viewNotice.hidden = true;
      orbitPager.hidden = true;
      pauseBtn.hidden = true;
      stage.setActive(false);
      renderRangeIndex(rangeIndex, 0, 0, 0, tasks);
      readerDialog.refresh(visible, tasks, today);
      return;
    }

    if (effectiveView === 'orbit') {
      const pageData = paginateOrbit(visible, orbitPage, ORBIT_LIMIT);
      orbitPage = pageData.page;

      listView.hidden = true;
      orbitalView.hidden = false;
      viewNotice.hidden = true;

      renderOrbitalStage(stageEl, boxTemplate, pageData.items, pageData.startIndex, today);
      stage.setActive(true);
      stage.sync();

      orbitPager.hidden = pageData.totalPages <= 1;
      orbitPageLabel.textContent = `Hal ${pageData.page} / ${pageData.totalPages}`;
      orbitPrev.disabled = pageData.page <= 1;
      orbitNext.disabled = pageData.page >= pageData.totalPages;

      pauseBtn.hidden = pageData.items.length <= 1;
      syncPauseButton(stage.isPaused());
      renderRangeIndex(rangeIndex, pageData.startIndex, pageData.endIndex, visible.length, tasks);
    } else {
      stage.setActive(false);
      orbitalView.hidden = true;
      listView.hidden = false;
      orbitPager.hidden = true;
      pauseBtn.hidden = true;

      const autoSwitched = viewPreference === 'auto' && visible.length > ORBIT_LIMIT;
      viewNotice.hidden = !autoSwitched;
      if (autoSwitched) {
        viewNoticeText.textContent = `Menampilkan ${visible.length} tugas dalam mode Daftar (>${ORBIT_LIMIT} tugas).`;
      }

      renderAccessibleList(listEl, rowTemplate, visible, today);
      renderRangeIndex(rangeIndex, 1, visible.length, visible.length, tasks);
    }

    readerDialog.refresh(visible, tasks, today);
  }

  function setViewMode(mode: ViewMode): void {
    viewPreference = mode;
    orbitPage = 1;
    render();
    announce(mode === 'orbit' ? 'Menampilkan mode Orbit.' : 'Menampilkan mode Daftar.');
  }

  const dialog = initTaskDialog(document, {
    onCreate(draft) {
      tasks = createTask(tasks, draft);
      persist();
      const visible = visibleTasks();
      const effectiveView = resolveEffectiveView(visible.length, viewPreference);
      if (effectiveView === 'orbit' && visible.length > ORBIT_LIMIT) {
        orbitPage = Math.ceil(visible.length / ORBIT_LIMIT);
      }
      render();
      if (filter === 'completed') {
        announce('Tugas ditambahkan dengan status belum selesai; tidak tampil pada filter Selesai.');
      } else {
        announce('Tugas baru ditambahkan.');
      }
    },
    onEdit(id, draft) {
      const before = tasks.find((task) => task.id === id);
      tasks = updateTask(tasks, id, draft);
      const unchanged =
        before !== undefined &&
        before.title === draft.title &&
        before.course === draft.course &&
        before.deadline === draft.deadline;
      if (!unchanged) persist();
      render();
      announce('Tugas diperbarui.');
    },
  });

  const deleteDialog = initDeleteDialog(document, (id) => {
    if (!tasks.some((task) => task.id === id)) return;
    const fromReader = readerDialog.isOpen();
    if (fromReader) readerDialog.close(false);
    tasks = removeTask(tasks, id);
    persist();
    render();
    announce('Tugas dihapus.');
  });

  function openDeleteFor(task: Task, cancelFocus: () => HTMLElement | null): void {
    const next = survivorId(visibleTasks(), task.id);
    deleteDialog.open(task, (deleted) => {
      if (!deleted) return cancelFocus() ?? fallbackFocus();
      return (next === null ? null : taskControl(next)) ?? fallbackFocus();
    });
  }

  function handleToggle(id: number, fromReader: boolean): void {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const next = survivorId(visibleTasks(), id);
    tasks = toggleStatus(tasks, id);
    persist();
    render();

    const message = task.status === 'selesai' ? 'Ditandai belum selesai.' : 'Ditandai selesai.';
    if (fromReader) {
      announce(message);
      return;
    }

    const stillVisible = listControl(id, 'toggle');
    if (stillVisible) {
      stillVisible.focus();
      announce(message);
    } else {
      const neighbour = next === null ? null : listControl(next, 'toggle');
      (neighbour ?? fallbackFocus()).focus();
      announce(`${message} Tugas tidak tampil pada filter ${FILTER_LABELS[filter]}.`);
    }
  }

  emptyAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));
  headerAdd.addEventListener('click', () => dialog.openCreate(visibleAddButton));

  filterBar.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const value = target?.closest<HTMLElement>('[data-filter]')?.dataset.filter;
    if (!isTaskFilter(value) || value === filter) return;
    filter = value;
    orbitPage = 1;
    render();
    announce(`Menampilkan ${FILTER_LABELS[filter]}: ${filterCounts(tasks)[filter]} tugas.`);
  });

  showAll.addEventListener('click', () => {
    filter = 'all';
    orbitPage = 1;
    render();
    filterButton(filterBar, 'all').focus();
    announce(`Menampilkan semua: ${tasks.length} tugas.`);
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
    orbitPage -= 1;
    render();
    announce(`Menampilkan halaman orbital ${orbitPage}.`);
  });

  orbitNext.addEventListener('click', () => {
    orbitPage += 1;
    render();
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
