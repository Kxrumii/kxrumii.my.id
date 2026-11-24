# Task Manager — PAW Pertemuan 6

Aplikasi pengelola tugas berbasis Vanilla TypeScript dan Vite untuk **Tugas PAW Pertemuan 6** pada monorepo `kxrumii.my.id` (`@kxrumii/pertemuan-6`, base path `/tugas/pertemuan-6/`).

Task Manager memadukan dua mode tampilan tersinkronisasi di atas satu store data tervalidasi: **Accessible List View** dua kolom sebagai tampilan bawaan dengan gulir vertikal mandiri, serta **Orbital Stage** spasial dengan enam arketipe kartu tipografis deterministik dan **Reader Dialog** full-sheet native `<dialog>`.

---

## Fitur Utama

- **Brand & Identitas Produk (`Task Manager`):** Header utama menampilkan brand `Task Manager` yang terhubung ke Portal Tugas (`/tugas/`), sementara halaman dokumentasi mempertahankan label akademik `DOKUMENTASI · PERTEMUAN 06`.
- **Manajemen Tugas Penuh (CRUD):** Tambah dan edit tugas lewat form `<dialog>` native dengan validasi per field (`title` dan `course` wajib setelah trim; `category`, `description`, serta `deadline` berformat `YYYY-MM-DD` bersifat opsional), plus dialog konfirmasi hapus yang aman terhadap double-submit.
- **Pembaruan Status & Aksesibilitas:** Pembalikan status dua arah (`belum-selesai` ↔ `selesai`) melalui checkbox di mode Daftar maupun tombol aksi di Reader Dialog, dengan pengumuman `aria-live="polite"` dan pemulihan fokus eksplisit.
- **Pencarian Real-Time & Filter Status:** Pencarian per sesi pada `title`, `course`, `category`, dan `description` yang dipadukan dengan filter `Semua`, `Belum`, dan `Selesai`. Jumlah pada bilah filter dan footer selalu dihitung dari keseluruhan koleksi.
- **Persistensi `localStorage` (Skema v1):** Disimpan dalam amplop `{ version: 1, tasks }` (`STORAGE_VERSION = 1`) dengan runtime type guard ketat, penyaringan record rusak/duplikat, peringatan non-destruktif saat data korup, serta fallback in-memory bila storage diblokir.
- **Kontinuitas Tampilan & Tata Letak (M2.1 CP1):** Peralihan halus `List ↔ Orbit` berbasis `task.id` stabil, keyed List reconciliation (`reconcileAccessibleList`) tanpa flicker survivor saat mengetik pencarian, FLIP reflow untuk baris yang bergeser, interpolasi koordinat Orbital terpisah dari status jeda manual (`manualPaused`), dan mikrointeraksi CSS terkendali.
- **Kontinuitas Kartu ↔ Reader Dialog (M2.1 CP2 & CP4-A):** Pembukaan Reader menganimasikan transisi spasial `clip-path` dari kartu Daftar atau `.box-print` Orbital menuju sheet penuh; penutupan menyelaraskan dialog, `.reader-bar`, `.reader-article`, dan fade CSS `::backdrop` kembali ke kartu tugas yang sedang aktif (termasuk setelah `Sebelumnya` / `Berikutnya`), dengan pembersihan animasi menyeluruh dan fallback M2.
- **Koordinasi Tambah Tugas (M2.1 CP4-B):** Penyerahan form tambah menutup `#task-dialog` sebelum render agar reflow Orbital tidak terblokir, menggulir otomatis baris baru ke area pandang Daftar bila berada di luar viewport, serta menganimasikan kartu baru dan caption-nya di Orbital tanpa memicu reflow lintas halaman saat melewati batas 12 kartu (`12 → 13`).
- **Halaman Dokumentasi & Accordion Progressive (M2.1 CP3 & CP4-C):** Halaman terpisah `/tugas/pertemuan-6/dokumentasi/` terhubung dua arah via `@kxrumii/transition-bridge`, memakai 9 topik `<details class="note">` native dengan animasi tinggi WAAPI yang aman terhadap interupsi, resize, keyboard, no-JS, dan reduced motion.

---

## Stack Teknologi

- **Bahasa:** TypeScript `^7.0.2` (`strict` mode, pemeriksaan via `tsc --noEmit`)
- **Bundler & Dev Server:** Vite `^8.3.8` (Oxc + Rolldown; konfigurasi multi-page di `vite.config.ts`)
- **Dependensi Runtime:** Vanilla DOM / native `<dialog>` & `<details>` / Web Animations API + paket internal `@kxrumii/transition-bridge` (`0.4.0`) — tanpa UI framework atau library animasi eksternal
- **Font Self-Hosted (SIL OFL 1.1):** 5 keluarga font lokal (`Newsreader`, `Archivo Black`, `DM Sans`, `Barlow Condensed`, `Source Code Pro`) di `src/fonts/` (tanpa request Google Fonts saat runtime)
- **Test Runner:** Node.js built-in test runner (`node:test`) dan `node:assert/strict`
- **Toolchain & Workspaces:** Node.js `26.13.1` (`.nvmrc`; root `engines.node >= 26.13.1`), `npm@12.2.3`

---

## Struktur Proyek

```text
apps/pertemuan-6/
├── index.html                  # Shell utama aplikasi, template kartu/baris, empty state, & <dialog>
├── dokumentasi/
│   └── index.html              # Halaman dokumentasi teknis (navigasi bridge dua arah & accordion)
├── package.json                # Script workspace & dependensi @kxrumii/pertemuan-6
├── tsconfig.json               # Konfigurasi TypeScript strict
├── vite.config.ts              # Base /tugas/pertemuan-6/, multi-entry, injeksi bootstrap transisi v4
├── .env.example                # Template environment variable publik (VITE_APP_NAME, VITE_APP_VERSION)
├── src/
│   ├── main.ts                 # Inisialisasi aplikasi, state sesi, keyed DOM sync, flush bridge
│   ├── types.ts                # Tipe inti (Task, TaskDraft, TaskStatus, ViewMode, archetypes)
│   ├── tasks.ts                # Mutasi tugas murni, urgency tenggat, cache formatter tanggal id-ID
│   ├── validation.ts           # Normalisasi & validasi form murni (Result<T, E>)
│   ├── filters.ts              # Filter status murni, hitungan koleksi penuh, pencocokan search
│   ├── storage.ts              # Persistensi localStorage, validasi skema v1, preferensi mode tampilan
│   ├── render.ts               # Render aman (textContent), keyed reconciliation Daftar & Orbital
│   ├── orbital-stage.ts        # Proyeksi Fibonacci/ekuatorial, drag/tap/keyboard, drift & coordinate reflow
│   ├── archetypes.ts           # Penetapan deterministik 6 arketipe visual, proporsi, dan permukaan
│   ├── motion.ts               # Registry WAAPI terpusat, guard canAnimate(), geometri FLIP & clip-path
│   ├── reader-dialog.ts        # Full-sheet Reader Dialog, morph buka/tutup, Prev/Next, clearReaderAnimations()
│   ├── task-dialog.ts          # Dialog tambah/edit native <dialog>, validasi, close-before-create fokus
│   ├── delete-dialog.ts        # Konfirmasi hapus dengan double-submit guard
│   ├── accordion.ts            # Progressive-enhancement WAAPI untuk <details class="note"> di Dokumentasi
│   ├── theme.ts                # Resolusi tema Dark/Light, fallback storage, sinkronisasi warna bridge
│   ├── transition.ts           # Instalasi Shared Transition Bridge & observer perubahan tema
│   ├── docs.ts                 # Runtime halaman dokumentasi (env publik, tahun, accordion & exit flush)
│   ├── style.css               # Token desain, layout Orbit/Daftar/Dialog/Docs, fade ::backdrop & bridge CSS
│   ├── fonts.css               # Deklarasi @font-face lokal untuk 5 keluarga font OFL
│   └── vite-env.d.ts           # Definisi tipe Vite client & import.meta.env
└── tests/                      # 10 suite test (156 unit & integration test via node:test)
    ├── accordion.test.ts
    ├── archetypes.test.ts
    ├── filters.test.ts
    ├── motion.test.ts
    ├── orbital-stage.test.ts
    ├── reader-dialog.test.ts
    ├── storage.test.ts
    ├── tasks.test.ts
    ├── theme.test.ts
    └── validation.test.ts
```

---

## Model Data & Persistensi

Didefinisikan pada `src/types.ts`:

```ts
export type TaskStatus = 'belum-selesai' | 'selesai';

export interface Task {
  id: number;
  title: string;
  course: string;
  category?: string;
  description?: string;
  /** Tanggal kalender `YYYY-MM-DD`, atau `null` bila kosong. */
  deadline: string | null;
  status: TaskStatus;
}
```

- **Field opsional S2:** `category` dan `description` di-trim saat input dan tidak disertakan ke objek tersimpan bila kosong.
- **Penyimpanan tugas (`kxrumii:pertemuan-6:tasks:v1`):** Disimpan sebagai `{ "version": 1, "tasks": [...] }` (`STORAGE_VERSION = 1`). Record v1 lama dengan lima field tetap valid; payload korup memunculkan peringatan non-destruktif tanpa menimpa data yang sudah ada sampai terjadi mutasi baru.
- **Preferensi tampilan (`kxrumii-task6-view-mode`):** Menyimpan `'list'` atau `'orbit'`, default `'list'`.
- **Preferensi tema (`kxrumii:pertemuan-6:theme`):** Menyimpan `'dark'` atau `'light'` (fallback mengikuti `prefers-color-scheme`, default `'dark'`).
- **State pencarian & filter sesi:** `filter` dan `searchQuery` hidup di memori sesi aktif agar perpindahan `Daftar ↔ Orbit` tetap menjaga hasil saringan yang sama.

---

## Mode Tampilan, Gerak & Transisi Rute

### Accessible List View (Bawaan)
- Grid editorial responsif 2 kolom pada desktop/tablet dan 1 kolom pada layar mobile dengan gulir mandiri pada `.list-view` (`overflow-y: auto; overscroll-behavior: contain`).
- `reconcileAccessibleList()` mempertahankan node `<li data-task-id>` yang bertahan agar fokus checkbox tidak hilang dan tidak ada flicker opacity saat mengetik pencarian; baris yang berpindah tempat dianimasikan dengan FLIP `transform`-only (`list-reflow`).

### Orbital Stage
- Proyeksi adaptif: 1 kartu terpusat, 2–3 kartu membentuk busur ekuatorial, dan 4+ kartu tersebar pada bola Fibonacci dengan batas halaman `ORBIT_LIMIT = 12`.
- Kepemilikan `transform` luar pada `.task-box` dan `.box-caption` sepenuhnya dipegang loop `requestAnimationFrame` `orbital-stage.ts`. Saat daftar berubah, `displayCoords` menginterpolasi slot baru secara internal tanpa memengaruhi status pause manual (`manualPaused`), dan otomatis berhenti saat idle drift nonaktif serta settling selesai.
- Drag `> 6px` memutar panggung; tap `<= 6px` membuka Reader Dialog; pengguna keyboard dapat fokus dengan `Tab` (`z-index: 1900`) dan memutar panggung dengan `ArrowLeft` / `ArrowRight`.

### Sistem Gerak & `@kxrumii/transition-bridge`
- Guard terpusat `canAnimate()` pada `src/motion.ts` menghentikan seluruh WAAPI ketika `prefers-reduced-motion: reduce` aktif atau atribut `data-transition-state` terpasang.
- Konfigurasi CSS transisi rute (`[data-transition-exit], [data-transition-enter]` dalam `src/style.css`):
  - **Exit (`360ms`, stagger `38ms`):** Bergerak naik `translate3d(0, -3vh, 0)` dengan klip `inset(0 0 100% 0)`.
  - **Enter (`600ms`, delay `0`):** Masuk dari `translate3d(0, -3vh, 0)` dan `inset(0 0 100% 0)` menuju posisi akhir secara vertikal agar konsisten di kedua arah (`Portal ↔ Task 6` dan `Task 6 ↔ Dokumentasi`).
- Ketika `kxrumii:transition` memancarkan `phase: 'exit-start'`, `bindBridgeCancellation()` membatalkan seluruh grup animasi aktif dan memanggil flush handler untuk menyelesaikan penghapusan tertunda, timer pencarian, node orbital keluar, accordion aktif, maupun menutup Reader Dialog secara bersih tanpa mencuri fokus.

---

## Rute & Environment Variables

| Rute | Dokumen Sumber | Bootstrap Bridge | Keterangan |
|---|---|---|---|
| `/tugas/pertemuan-6/` | `apps/pertemuan-6/index.html` | Ya (`1` inline v4 bootstrap via `vite.config.ts`) | Aplikasi utama Task Manager (`pageId: "task-6"`) |
| `/tugas/pertemuan-6/dokumentasi/` | `apps/pertemuan-6/dokumentasi/index.html` | Ya (`1` inline v4 bootstrap via `vite.config.ts`) | Dokumentasi arsitektur & catatan teknis (`pageId: "task-6-docs"`) |

`npm run verify:transition` memverifikasi keberadaan tepat satu bootstrap transisi v4 pada **7 dokumen aplikasi** di `dist/` (`index.html`, `tugas/index.html`, `tugas/pertemuan-1/index.html`, `tugas/pertemuan-6/index.html`, `tugas/pertemuan-6/dokumentasi/index.html`, `tugas/pertemuan-7/index.html`, `tugas/pertemuan-8/index.html`) serta memastikan `profil/index.html` tetap menjadi redirect tanpa bootstrap.

| Variabel | Fungsi | Default |
|---|---|---|
| `VITE_APP_NAME` | Nilai `#page-title` (`sr-only`) dan tampilan nama env di dokumentasi | `Task Manager` |
| `VITE_APP_VERSION` | Versi yang ditampilkan pada halaman dokumentasi | `1.0.0` |

Salin `apps/pertemuan-6/.env.example` menjadi `.env` (gitignored) bila membutuhkan override lokal. Jangan menyimpan secret atau credential pada variabel `VITE_*` karena nilainya di-inline ke bundle klien. *(Catatan: bila `.env` lokal masih berisi nilai lama seperti `College Task Manager`, build lokal akan membaca nilai `.env` lokal tersebut sebagai override `VITE_APP_NAME`, sementara header `.brand` tetap menampilkan `Task Manager`.)*

---

## Font Self-Hosted & Lisensi

Seluruh font berada di `apps/pertemuan-6/src/fonts/` di bawah **SIL Open Font License, Version 1.1 (OFL-1.1)**. Rincian lengkap dan file lisensi resmi tersedia di [src/fonts/LICENSES.md](./src/fonts/LICENSES.md).

| Keluarga Font | File `.woff2` | Bobot / Gaya | Atribusi Hulu |
|---|---|---|---|
| **Newsreader** | `newsreader-latin-var.woff2`, `newsreader-latin-italic-var.woff2` | 400–600 (normal & italic, variable) | Production Type (`github.com/productiontype/Newsreader`) |
| **Archivo Black** | `archivo-black-latin-400.woff2` | 400 (normal) | Omnibus-Type (`github.com/Omnibus-Type/ArchivoBlack`) |
| **DM Sans** | `dm-sans-latin-var.woff2` | 400–700 (normal, variable) | DM Sans Project Authors (`github.com/googlefonts/dm-fonts`) |
| **Barlow Condensed** | `barlow-condensed-latin-700.woff2`, `barlow-condensed-latin-800.woff2` | 700, 800 (normal) | Jeremy Tribby (`github.com/jpt/barlow`) |
| **Source Code Pro** | `source-code-pro-latin-var.woff2` | 300–600 (normal, variable) | Adobe Systems Incorporated (`github.com/adobe-fonts/source-code-pro`) |

---

## Pengembangan, Build & Verifikasi

Jalankan dari root repository (`Node.js >= 26.13.1`, `npm@12.2.3`):

```bash
npm ci                                            # Pasang dependency seluruh workspace
npm run dev:t6                                    # Dev server Task Manager (base /tugas/pertemuan-6/)
npm run check                                     # Pemeriksaan tipe TypeScript seluruh workspace (tsc --noEmit)
npm run test --workspace=@kxrumii/pertemuan-6     # Jalankan 156 tes unit & integrasi Task 6 (51 suites)
npm run build --workspace=@kxrumii/pertemuan-6    # Typecheck & build Vite ke public/tugas/pertemuan-6/
npm run build                                     # Bersihkan artefak lama, build semua app Vite, lalu astro build -> dist/
npm run verify:transition                         # Verifikasi bootstrap transisi v4 pada 7 dokumen di dist/
npm run preview                                   # Pratinjau situs statis lengkap dari dist/
```

Catatan pipeline:
- Selalu jalankan `npm run build --workspace=@kxrumii/pertemuan-6` (atau root `npm run build`) untuk menghasilkan `dist/` terbaru sebelum menjalankan `npm run verify:transition`.
- Di lingkungan sandbox tanpa akses tulis ke `~/.config/astro`, build root dijalankan dengan `ASTRO_TELEMETRY_DISABLED=1 XDG_CONFIG_HOME=/tmp npm run build`.

---

## Alur Git, Status Saat Ini & Keterbatasan

- **Alur integrasi:** Fitur dikembangkan pada feature branch dan digabungkan ke `main` melalui Pull Request. Workflow CI `.github/workflows/ci.yml` (`build-and-verify`) menjalankan `npm run check`, `npm audit --audit-level=moderate`, `npm run build`, pengecekan file halaman di `dist/`, dan `node scripts/verify-transition-bootstrap.mjs`.
- **Riwayat integrasi `main`:**
  - **PR #5** (`4ff59f3`, `b6ff182`): bukti penyelesaian merge conflict historis antara `feature/pertemuan-6-task-manager` dan `docs/pertemuan-6-notes`.
  - **PR #7** (`ca21ef6`): penggabungan selesai milestone **M1** (Orbital Stage Core) dan **M2** (Accessible List View, skema S2, Search, Motion System, Reader Dialog fix, serta vertical Shared Transition Bridge) ke `main`.
- **Status M2.1 & M3 saat ini:** Implementasi lengkap **M2.1** (`CP3` transisi rute Dokumentasi, `CP1` kontinuitas List ↔ Orbit & reflow, `CP2` morph Kartu ↔ Reader, `CP4` branding `Task Manager`, koordinasi tambah tugas, refinement close Reader, dan accordion Dokumentasi WAAPI) serta sinkronisasi dokumentasi **M3** saat ini berada pada working tree branch **`feature/pertemuan-6-m2-1-cp3-docs-transition`** (basis `ca21ef6`), **belum di-commit, belum di-merge ke `main`, dan belum di-deploy**.
- **Keterbatasan penyimpanan:** Seluruh data tugas, tema, dan mode tampilan disimpan secara lokal di `localStorage` browser; aplikasi tidak memiliki backend API, akun pengguna, atau sinkronisasi antar perangkat.
