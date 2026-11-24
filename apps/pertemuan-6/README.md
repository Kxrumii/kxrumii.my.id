# College Task Manager — PAW Task 6

A Vanilla TypeScript and Vite task manager built for **Tugas PAW Pertemuan 6** in the `kxrumii.my.id` monorepo (`@kxrumii/pertemuan-6`, base path `/tugas/pertemuan-6/`).

The application pairs two synchronized views over a single validated task store: a default, searchable two-column **Accessible List View** with independent vertical scrolling, and an interactive **Orbital Stage** spatial collection view with six deterministic typographic card archetypes.

---

## Features

- **Full Task CRUD:** Create and edit tasks via native `<dialog>` forms with inline validation (`title` and `course` required after trimming; optional `category`, `description`, and `YYYY-MM-DD` `deadline`), plus explicit delete confirmation.
- **Status Management:** Bidirectional status toggling (`belum-selesai` ↔ `selesai`) from both the Accessible List View checkbox and the Reader Dialog, with synchronous updates and accessible live-region announcements.
- **Unified Search & Status Filtering:** Real-time session-only search across `title`, `course`, `category`, and `description`, combined with `Semua`, `Belum`, and `Selesai` status filters. Filter counts and footer totals always reflect the full task collection.
- **`localStorage` Persistence (Schema v1):** Versioned `{ version: 1, tasks }` envelope (`STORAGE_VERSION = 1`) with strict runtime validation, safe skipping of malformed/duplicate records, non-destructive load failure notices, and in-memory fallback if storage is unavailable or full.
- **Orbit / List View Switching & Pagination:** Persisted `list` / `orbit` view preference (defaulting to Accessible List View on first visit), plus explicit Orbit pagination capped at 12 cards per page (`ORBIT_LIMIT = 12`).
- **Accessible List View:** Responsive two-column editorial grid on desktop/tablet (`1` column on mobile) with independent vertical scroll containment while keeping the header, utility bar, and footer visible.
- **Editorial Reader Dialog:** Full-viewport `<dialog>` sheet displaying full title, course, optional category/description, formatted deadline, urgency state, status toggle, Edit, Delete, Previous/Next task navigation, and a top-right `Tutup ×` exit control.
- **Light & Dark Themes:** Pre-paint theme initialization in `<head>` with persistent theme toggle (`dark` default, or OS preference fallback) synchronized with the Shared Transition Bridge canvas color.
- **Motion & Reduced-Motion Support:** Centralized WAAPI choreography registry with `prefers-reduced-motion: reduce` and active route-transition guards.
- **Shared Route Transition Integration:** Vertical clip-hidden enter/exit coordination with `@kxrumii/transition-bridge` (`0.4.0`), including full motion cancellation and timer/dialog/DOM cleanup on `kxrumii:transition` (`exit-start`).

---

## Technology Stack

- **Language:** TypeScript `^7.0.2` (`strict` mode, checked via `tsc --noEmit`)
- **Bundler & Dev Server:** Vite `^8.3.8`
- **Runtime Dependencies:** Vanilla DOM / native `<dialog>` / Web Animations API + internal workspace `@kxrumii/transition-bridge` (`0.4.0`) — no UI framework or third-party runtime animation library
- **Self-Hosted Fonts (SIL OFL 1.1):** 5 font families (`Newsreader`, `Archivo Black`, `DM Sans`, `Barlow Condensed`, `Source Code Pro`) served locally from `src/fonts/` (no Google Fonts runtime requests)
- **Test Runner:** Node.js built-in test runner (`node:test`) and `node:assert/strict`
- **Toolchain & Workspaces:** Node.js `26.13.1` (`.nvmrc`; root `engines.node >= 26.13.1`), `npm@12.2.3`

---

## Project Structure

```text
apps/pertemuan-6/
├── index.html                  # App shell, templates, empty states, Reader/Task/Delete <dialog>s
├── dokumentasi/
│   └── index.html              # Standalone technical notes page (native navigation, no bridge)
├── package.json                # Workspace scripts and dependencies
├── tsconfig.json               # Strict TypeScript config (checks src/)
├── vite.config.ts              # /tugas/pertemuan-6/ base, app-only transition bootstrap, build outDir
├── .env.example                # Non-secret public VITE_APP_NAME / VITE_APP_VERSION template
├── src/
│   ├── main.ts                 # App initialization, in-memory state, DOM wiring, route exit flush hooks
│   ├── types.ts                # Core interfaces/unions (Task, TaskDraft, TaskStatus, ViewMode, archetypes)
│   ├── tasks.ts                # Pure task mutations, deadline states, cached id-ID date formatter
│   ├── validation.ts           # Pure form normalization & field-level validation (Result<T, E>)
│   ├── filters.ts              # Pure status filtering, full-collection counts, and search matching
│   ├── storage.ts              # localStorage persistence, schema validation, and view-mode preference
│   ├── render.ts               # XSS-safe DOM rendering (textContent only), List rows, keyed Orbit diff
│   ├── orbital-stage.ts        # Orbital Fibonacci/equatorial projection, drag/tap/keyboard & drift loop
│   ├── archetypes.ts           # Deterministic assignment of 6 box archetypes, proportions, and surfaces
│   ├── motion.ts               # Centralized WAAPI registry, guards, stagger delays, delete coordinator
│   ├── reader-dialog.ts        # Full-sheet Reader Dialog, animations, Prev/Next focus, Escape cleanup
│   ├── task-dialog.ts          # Create/Edit <dialog> controller, error handling, focus restoration
│   ├── delete-dialog.ts        # Delete confirmation <dialog> with double-submit guard
│   ├── theme.ts                # Dark/Light theme resolution, persistence, and bridge canvas sync
│   ├── transition.ts           # Shared Transition Bridge installation & theme color observer
│   ├── docs.ts                 # Technical notes page runtime (reads public Vite env vars & year)
│   ├── style.css               # Design tokens, Orbit/List/Dialog/Docs layout, vertical bridge tokens
│   ├── fonts.css               # Local @font-face declarations for self-hosted OFL fonts
│   └── vite-env.d.ts           # Vite client & import.meta.env type definitions
└── tests/                      # 9 unit & integration test suites executed directly via node:test
```

---

## Data Model & Persistence

Defined in `src/types.ts`:

```ts
export type TaskStatus = 'belum-selesai' | 'selesai';

export interface Task {
  id: number;
  title: string;
  course: string;
  category?: string;
  description?: string;
  /** Calendar date `YYYY-MM-DD`, or `null` when omitted. */
  deadline: string | null;
  status: TaskStatus;
}
```

- **Optional S2 fields:** `category` and `description` are trimmed on input and omitted from stored/returned objects when empty.
- **Tasks storage (`kxrumii:pertemuan-6:tasks:v1`):** Stored as `{ "version": 1, "tasks": [...] }` (`STORAGE_VERSION = 1`). Legacy five-field v1 records without `category`/`description` remain valid. Malformed payloads trigger a visible non-destructive warning without overwriting existing storage until the user mutates tasks.
- **View preference (`kxrumii-task6-view-mode`):** Persists `'list'` or `'orbit'`, defaulting to `'list'` on first visit.
- **Theme preference (`kxrumii:pertemuan-6:theme`):** Persists `'dark'` or `'light'`.
- **Session-only query state:** The search input (`searchQuery`) and active status filter (`filter`) live in memory for the current session so switching between List and Orbit preserves filtered results, resetting on full reload.

---

## Views & Interaction

### Accessible List View (Default)

- Displays tasks in a responsive two-column grid (`> 1` column on desktop/tablet, `1` column on narrow screens).
- Only the `.list-view` collection container scrolls vertically (`overflow-y: auto; overscroll-behavior: contain` inside the `100dvh` `.stage-shell`), keeping the header, utility bar (filters + search), and footer visible.
- Status checkboxes sit directly alongside the status label (`Belum selesai` / `Selesai`), separate from the card title trigger (`open`), `Edit`, and `Hapus` controls.

### Orbital Stage

- **Adaptive projection (`computeOrbitalPositions`):** `1` task is centered, `2–3` tasks form a balanced equatorial arc, and `4+` tasks distribute onto a Fibonacci-sphere projection.
- **Explicit pagination (`ORBIT_LIMIT = 12`):** Keeps up to 12 cards per Orbit page with `←` / `→` controls and `Hal X / Y` indicator.
- **Pointer & keyboard input:** Dragging `> 6px` rotates azimuth/pitch; tapping `<= 6px` opens the Reader Dialog. Keyboard users can focus cards via `Tab`, elevate focused cards (`z-index: 1900`), and rotate the stage with `ArrowLeft` / `ArrowRight`.
- **Idle drift & pause:** Pointer hover visually highlights `.box-print` without pausing orbital drift. Drift pauses automatically on manual `#stage-pause`, active drag, keyboard `:focus-visible` inside the stage, any open `<dialog>`, `document.hidden`, `prefers-reduced-motion: reduce`, or an active route transition (`data-transition-state`).

---

## Motion & Accessibility

- **Central Guard (`src/motion.ts`):** `canAnimate()` permits WAAPI animations only when `prefers-reduced-motion` is false, `data-transition-state` is absent, and `Element.prototype.animate` is supported.
- **Strict Orbital Transform Ownership:** Outer `.task-box` and `.box-caption` `transform` properties are owned exclusively by the `requestAnimationFrame` orbital loop. Keyed DOM reconciliation (`reconcileOrbitalStage` + `data-caption-for`) preserves nodes across updates and animates filter/search/delete transitions only on the inner `.box-print` element while marking exiting nodes `inert` and `aria-hidden="true"`.
- **List & Dialog Choreography:** Filter/search updates stagger up to 8 visible rows (`24ms` steps); adding/toggling tasks plays short entrance/status feedback; deletions persist synchronously first (`createDeleteCoordinator`) before a `180ms` exit animation with a `300ms` timeout fallback. Reader Dialog supports animated open/close, Escape / double-Escape instant dismissal, directional Prev/Next transitions (`±16px`), boundary focus handoff, and full cleanup of `fill: 'forwards'` animations on close/reopen.
- **Route Transitions (`@kxrumii/transition-bridge`):**
  - Task 6 defines unitless-millisecond CSS custom properties on `[data-transition-exit], [data-transition-enter]` in `src/style.css`:
    - **Exit (`Task 6 → Portal`):** translates upward (`translate3d(0, -3vh, 0)`), clips upward from the bottom (`inset(0 0 100% 0)`), duration `360` ms, stagger `38` ms.
    - **Enter (`Portal → Task 6`):** starts from `translate3d(0, -3vh, 0)` with `inset(0 0 100% 0)` and moves downward into place while revealing top-to-bottom over `600` ms (`delay: 0`).
  - On `kxrumii:transition` (`phase: 'exit-start'`), Task 6 cancels all registered WAAPI groups, flushes pending delete coordinators without restoring focus, clears `searchAnnounceTimer`, removes exiting Orbit nodes, and immediately closes an open Reader Dialog (`close(false)`).

---

## Routes & Environment Variables

| Route | Document | Bridge Bootstrap | Purpose |
|---|---|---|---|
| `/tugas/pertemuan-6/` | `apps/pertemuan-6/index.html` | Yes (`1` inline v4 bootstrap via `vite.config.ts`) | Main College Task Manager application |
| `/tugas/pertemuan-6/dokumentasi/` | `apps/pertemuan-6/dokumentasi/index.html` | No (`0`; native document navigation) | Technical documentation & runtime env display |

Create a local `.env` in `apps/pertemuan-6/` from `.env.example` if overriding defaults (`.env` is gitignored):

| Variable | Purpose | Default |
|---|---|---|
| `VITE_APP_NAME` | Application `<h1 id="page-title">` and docs display | `College Task Manager` |
| `VITE_APP_VERSION` | Version displayed on the documentation page | `1.0.0` |

> Variables prefixed with `VITE_` are inlined into client bundles. Never store secrets, tokens, or credentials in `VITE_*` variables.

---

## Development

Run commands from the repository root (`Node.js >= 26.13.1`, `npm@12.2.3`):

```bash
npm ci                                            # Install monorepo workspace dependencies
npm run dev:t6                                    # Start Task 6 Vite dev server (http://127.0.0.1:5173/tugas/pertemuan-6/)
npm run check                                     # TypeScript check across all workspaces (tsc --noEmit)
npm run test --workspace=@kxrumii/pertemuan-6     # Run Task 6 unit & integration tests (node:test)
npm run build --workspace=@kxrumii/pertemuan-6    # Type-check & build Task 6 into public/tugas/pertemuan-6/
npm run build                                     # Clean generated dirs, build all Vite apps, run Astro build -> dist/
npm run verify:transition                         # Verify shared transition bootstrap & unitless timings in dist/
npm run preview                                   # Preview full built Astro site from dist/
```

---

## Build Output

- Running `npm run build --workspace=@kxrumii/pertemuan-6` compiles Task 6 with `base: '/tugas/pertemuan-6/'` into `public/tugas/pertemuan-6/` (gitignored).
- Running root `npm run build` cleans `public/tugas/` and `dist/`, builds all workspace apps (`pertemuan-1`, `pertemuan-6`, `pertemuan-7`, `pertemuan-8`), and executes `astro build` to produce the static production site in `dist/` (also gitignored).
- Always run Task 6's Vite build followed by root `npm run build` before running `npm run verify:transition` so verification inspects freshly generated `dist/` output rather than stale artifacts.

---

## Verification

Automated checks for Task 6 and the monorepo build pipeline:

```bash
npm run check
npm run test --workspace=@kxrumii/pertemuan-6
npm run build --workspace=@kxrumii/pertemuan-6
npm run build
npm run verify:transition
```

As of final M2 completion on `feature/pertemuan-6-visual-redesign`, the full CP3 check suite passed **139 / 139 tests** across **46 suites** (`0` failed, `0` skipped), followed by fresh Vite + Astro production builds, `npm run verify:transition`, and Zen (Firefox) / Brave (Chromium) verification after the final CSS enter-direction refinement. Future edits should re-run the full verification sequence above.

---

## Current Status & Limitations

- **Status:** M1 (Orbital Stage Core) and M2 (List View, S2 Schema, Search, Motion System, Reader Dialog fix, Shared Transition Bridge vertical alignment) are complete on the uncommitted feature branch `feature/pertemuan-6-visual-redesign` (HEAD `565b1e8`). Changes have not yet been committed, merged to `main`, or deployed to production.
- **Storage scope:** Persistence uses browser-local `localStorage` only; there is no backend API, authentication, or cross-device synchronization.
