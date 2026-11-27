# Task Manager: PAW Pertemuan 6

Ini aplikasi pengelola tugas yang kubuat pakai Vanilla TypeScript dan Vite untuk **Tugas PAW Pertemuan 6**, di monorepo `kxrumii.my.id` (`@kxrumii/pertemuan-6`, base path `/tugas/pertemuan-6/`).

Task Manager punya dua mode tampilan yang selalu sinkron karena berbagi satu store data yang tervalidasi. Yang pertama dan jadi bawaan adalah **Accessible List View** dua kolom dengan gulir vertikal sendiri. Yang kedua **Orbital Stage**, tampilan spasial dengan enam arketipe kartu tipografis yang deterministik. Buat membaca detail tugas ada **Reader Dialog** full-sheet dari `<dialog>` native.

---

## Fitur utama

- **Brand `Task Manager`:** header utama menampilkan brand `Task Manager` yang nyambung ke Portal Tugas (`/tugas/`). Halaman dokumentasi tetap memakai label akademik `DOKUMENTASI · PERTEMUAN 06`.
- **CRUD lengkap:** tambah dan edit tugas lewat form `<dialog>` native dengan validasi per field. `title` dan `course` wajib diisi setelah di-trim, sedangkan `category`, `description`, dan `deadline` (format `YYYY-MM-DD`) opsional. Dialog konfirmasi hapus juga aman dari double-submit.
- **Ubah status dan aksesibilitas:** status bisa dibalik dua arah (`belum-selesai` ↔ `selesai`) lewat checkbox di mode Daftar atau tombol aksi di Reader Dialog. Perubahannya diumumkan lewat `aria-live="polite"` dan fokus dikembalikan secara eksplisit.
- **Pencarian real-time dan filter status:** pencarian per sesi di `title`, `course`, `category`, dan `description`, digabung dengan filter `Semua`, `Belum`, dan `Selesai`. Jumlah di bilah filter dan footer selalu dihitung dari seluruh koleksi.
- **Persistensi `localStorage` (skema v1):** data disimpan dalam amplop `{ version: 1, tasks }` (`STORAGE_VERSION = 1`) dengan runtime type guard yang ketat. Record rusak atau duplikat disaring, data korup memunculkan peringatan yang nggak merusak apa-apa, dan kalau storage diblokir aplikasi jatuh ke penyimpanan in-memory.
- **Perpindahan tampilan yang mulus (M2.1 CP1):** peralihan `List ↔ Orbit` berbasis `task.id` yang stabil. List di-reconcile per key (`reconcileAccessibleList`) supaya nggak ada flicker saat mengetik di pencarian, baris yang bergeser dianimasikan dengan FLIP, koordinat Orbital diinterpolasi terpisah dari status jeda manual (`manualPaused`), dan mikrointeraksi CSS dijaga tetap terkendali.
- **Kartu ↔ Reader Dialog (M2.1 CP2 dan CP4-A):** waktu Reader dibuka, ada transisi spasial `clip-path` dari kartu Daftar atau `.box-print` Orbital ke sheet penuh. Waktu ditutup, dialog, `.reader-bar`, `.reader-article`, dan fade `::backdrop` balik ke kartu tugas yang sedang aktif (termasuk setelah `Sebelumnya` / `Berikutnya`). Semua animasi dibersihkan tuntas, dan ada fallback M2.
- **Tambah tugas yang rapi (M2.1 CP4-B):** form tambah menutup `#task-dialog` sebelum render supaya reflow Orbital nggak ketahan. Baris baru otomatis digulir ke area pandang Daftar kalau ada di luar viewport, dan kartu baru beserta caption-nya dianimasikan di Orbital tanpa reflow lintas halaman saat melewati batas 12 kartu (`12 → 13`).
- **Halaman dokumentasi dan accordion (M2.1 CP3 dan CP4-C):** halaman terpisah di `/tugas/pertemuan-6/dokumentasi/` terhubung dua arah lewat `@kxrumii/transition-bridge`. Isinya 9 topik `<details class="note">` native dengan animasi tinggi WAAPI yang aman saat diinterupsi, di-resize, dipakai lewat keyboard, tanpa JS, dan saat reduced motion.

---

## Stack

- **Bahasa:** TypeScript `^7.0.2` (mode `strict`, dicek lewat `tsc --noEmit`)
- **Bundler dan dev server:** Vite `^8.3.8` (Oxc + Rolldown, konfigurasi multi-page di `vite.config.ts`)
- **Dependensi runtime:** Vanilla DOM, `<dialog>` dan `<details>` native, Web Animations API, dan paket internal `@kxrumii/transition-bridge` (`0.4.0`). Nggak ada UI framework atau library animasi eksternal.
- **Font self-hosted (SIL OFL 1.1):** 5 keluarga font lokal (`Newsreader`, `Archivo Black`, `DM Sans`, `Barlow Condensed`, `Source Code Pro`) di `src/fonts/`, jadi nggak ada request ke Google Fonts saat runtime.
- **Test runner:** test runner bawaan Node.js (`node:test`) dan `node:assert/strict`
- **Toolchain dan workspaces:** Node.js `26.13.1` (`.nvmrc`, root `engines.node >= 26.13.1`), `npm@12.2.3`
- **Favicon:** ikon data-URI di `index.html` dan `dokumentasi/index.html`, dibuat dari logo F tanda tangan yang sama dengan Task 7 lewat `npm run favicons` di root repo.

---

## Struktur project

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

## Model data dan persistensi

Didefinisikan di `src/types.ts`:

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

- **Field opsional S2:** `category` dan `description` di-trim saat input, dan nggak ikut disimpan ke objek kalau kosong.
- **Penyimpanan tugas (`kxrumii:pertemuan-6:tasks:v1`):** disimpan sebagai `{ "version": 1, "tasks": [...] }` (`STORAGE_VERSION = 1`). Record v1 lama dengan lima field tetap valid. Kalau payload korup, muncul peringatan yang nggak menimpa data lama sampai ada mutasi baru.
- **Preferensi tampilan (`kxrumii-task6-view-mode`):** menyimpan `'list'` atau `'orbit'`, defaultnya `'list'`.
- **Preferensi tema (`kxrumii:pertemuan-6:theme`):** menyimpan `'dark'` atau `'light'`. Fallback-nya mengikuti `prefers-color-scheme`, dan defaultnya `'dark'`.
- **State pencarian dan filter sesi:** `filter` dan `searchQuery` hidup di memori selama sesi, jadi pindah `Daftar ↔ Orbit` tetap menjaga hasil saringan yang sama.

---

## Mode tampilan, gerak, dan transisi rute

### Accessible List View (bawaan)

- Grid editorial responsif: 2 kolom di desktop dan tablet, 1 kolom di layar mobile, dengan gulir mandiri di `.list-view` (`overflow-y: auto; overscroll-behavior: contain`).
- `reconcileAccessibleList()` mempertahankan node `<li data-task-id>` yang masih ada, jadi fokus checkbox nggak hilang dan nggak ada flicker opacity waktu mengetik di pencarian. Baris yang pindah tempat dianimasikan dengan FLIP `transform`-only (`list-reflow`).

### Orbital Stage

- Proyeksinya adaptif: 1 kartu di tengah, 2 sampai 3 kartu membentuk busur ekuatorial, dan 4 kartu atau lebih tersebar di bola Fibonacci. Batas per halaman `ORBIT_LIMIT = 12`.
- `transform` luar pada `.task-box` dan `.box-caption` sepenuhnya dipegang loop `requestAnimationFrame` di `orbital-stage.ts`. Saat daftar berubah, `displayCoords` menginterpolasi slot baru secara internal tanpa mengganggu status pause manual (`manualPaused`), dan berhenti sendiri saat idle drift nonaktif dan settling selesai.
- Drag `> 6px` memutar panggung, tap `<= 6px` membuka Reader Dialog. Pengguna keyboard bisa fokus dengan `Tab` (`z-index: 1900`) dan memutar panggung dengan `ArrowLeft` / `ArrowRight`.

### Sistem gerak dan `@kxrumii/transition-bridge`

- Guard terpusat `canAnimate()` di `src/motion.ts` menghentikan semua WAAPI saat `prefers-reduced-motion: reduce` aktif atau atribut `data-transition-state` terpasang.
- Konfigurasi CSS transisi rute (`[data-transition-exit], [data-transition-enter]` di `src/style.css`):
  - **Exit (`360ms`, stagger `38ms`):** bergerak naik `translate3d(0, -3vh, 0)` dengan klip `inset(0 0 100% 0)`.
  - **Enter (`600ms`, delay `0`):** masuk dari `translate3d(0, -3vh, 0)` dan `inset(0 0 100% 0)` ke posisi akhir secara vertikal, supaya konsisten di kedua arah (`Portal ↔ Task 6` dan `Task 6 ↔ Dokumentasi`).
- Waktu `kxrumii:transition` memancarkan `phase: 'exit-start'`, `bindBridgeCancellation()` membatalkan semua grup animasi yang aktif dan memanggil flush handler. Dengan begitu penghapusan yang tertunda, timer pencarian, node orbital yang keluar, accordion yang aktif, dan Reader Dialog yang terbuka semuanya beres tanpa mencuri fokus.

---

## Rute dan environment variable

| Rute | Dokumen sumber | Bootstrap bridge | Keterangan |
|---|---|---|---|
| `/tugas/pertemuan-6/` | `apps/pertemuan-6/index.html` | Ya (`1` inline v4 bootstrap via `vite.config.ts`) | Aplikasi utama Task Manager (`pageId: "task-6"`) |
| `/tugas/pertemuan-6/dokumentasi/` | `apps/pertemuan-6/dokumentasi/index.html` | Ya (`1` inline v4 bootstrap via `vite.config.ts`) | Dokumentasi arsitektur dan catatan teknis (`pageId: "task-6-docs"`) |

`npm run verify:transition` memastikan ada tepat satu bootstrap transisi v4 di **7 dokumen aplikasi** di `dist/` (`index.html`, `tugas/index.html`, `tugas/pertemuan-1/index.html`, `tugas/pertemuan-6/index.html`, `tugas/pertemuan-6/dokumentasi/index.html`, `tugas/pertemuan-7/index.html`, `tugas/pertemuan-8/index.html`). Skrip ini juga memastikan `profil/index.html` tetap berupa redirect tanpa bootstrap.

| Variabel | Fungsi | Default |
|---|---|---|
| `VITE_APP_NAME` | Nilai `#page-title` (`sr-only`) dan nama env yang tampil di dokumentasi | `Task Manager` |
| `VITE_APP_VERSION` | Versi yang tampil di halaman dokumentasi | `1.0.0` |

Salin `apps/pertemuan-6/.env.example` jadi `.env` (gitignored) kalau mau override di lokal. Jangan simpan secret atau credential di variabel `VITE_*`, karena nilainya di-inline ke bundle klien. *(Catatan: kalau `.env` lokal masih berisi nilai lama seperti `College Task Manager`, build lokal akan memakainya sebagai override `VITE_APP_NAME`, sementara header `.brand` tetap menampilkan `Task Manager`.)*

---

## Font self-hosted dan lisensi

Semua font ada di `apps/pertemuan-6/src/fonts/` di bawah **SIL Open Font License, Version 1.1 (OFL-1.1)**. Rincian lengkap dan file lisensi resminya ada di [src/fonts/LICENSES.md](./src/fonts/LICENSES.md).

| Keluarga font | File `.woff2` | Bobot / gaya | Atribusi hulu |
|---|---|---|---|
| **Newsreader** | `newsreader-latin-var.woff2`, `newsreader-latin-italic-var.woff2` | 400–600 (normal & italic, variable) | Production Type (`github.com/productiontype/Newsreader`) |
| **Archivo Black** | `archivo-black-latin-400.woff2` | 400 (normal) | Omnibus-Type (`github.com/Omnibus-Type/ArchivoBlack`) |
| **DM Sans** | `dm-sans-latin-var.woff2` | 400–700 (normal, variable) | DM Sans Project Authors (`github.com/googlefonts/dm-fonts`) |
| **Barlow Condensed** | `barlow-condensed-latin-700.woff2`, `barlow-condensed-latin-800.woff2` | 700, 800 (normal) | Jeremy Tribby (`github.com/jpt/barlow`) |
| **Source Code Pro** | `source-code-pro-latin-var.woff2` | 300–600 (normal, variable) | Adobe Systems Incorporated (`github.com/adobe-fonts/source-code-pro`) |

---

## Development, build, dan verifikasi

Jalankan dari root repo (`Node.js >= 26.13.1`, `npm@12.2.3`):

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

Dua catatan soal pipeline:

- Jalankan dulu `npm run build --workspace=@kxrumii/pertemuan-6` (atau `npm run build` di root) supaya `dist/` terbaru ada, baru jalankan `npm run verify:transition`.
- Di sandbox yang nggak punya akses tulis ke `~/.config/astro`, build root dijalankan dengan `ASTRO_TELEMETRY_DISABLED=1 XDG_CONFIG_HOME=/tmp npm run build`.

---

## Alur Git, status sekarang, dan keterbatasan

- **Alur integrasi:** fitur dikerjakan di feature branch lalu digabung ke `main` lewat Pull Request. Workflow CI `.github/workflows/ci.yml` (`build-and-verify`) menjalankan `npm run check`, `npm audit --audit-level=moderate`, `npm run build`, pengecekan file halaman di `dist/`, dan `node scripts/verify-transition-bootstrap.mjs`.
- **Riwayat integrasi `main`:**
  - **PR #5** (`4ff59f3`, `b6ff182`): bukti penyelesaian merge conflict historis antara `feature/pertemuan-6-task-manager` dan `docs/pertemuan-6-notes`.
  - **PR #7** (`ca21ef6`): menggabungkan milestone **M1** (Orbital Stage Core) dan **M2** (Accessible List View, skema S2, Search, Motion System, perbaikan Reader Dialog, dan vertical Shared Transition Bridge) ke `main`.
  - **PR #8** (`fd8e6f7`, commit fitur `971402b`): menggabungkan **M2.1** ke `main`.
- **Status M2.1 dan M3 saat ini:** implementasi **M2.1** lengkap (`CP3` transisi rute Dokumentasi, `CP1` kontinuitas List ↔ Orbit dan reflow, `CP2` morph Kartu ↔ Reader, `CP4` branding `Task Manager`, koordinasi tambah tugas, refinement close Reader, dan accordion Dokumentasi WAAPI), plus sinkronisasi dokumentasi **M3**. Semuanya sudah ada di `main` lewat PR #8. Favicon-nya ikut diganti ke logo F tanda tangan di branch `feature/pertemuan-7-react-vite`.
- **Keterbatasan penyimpanan:** semua data tugas, tema, dan mode tampilan disimpan lokal di `localStorage` browser. Aplikasi ini nggak punya backend API, akun pengguna, atau sinkronisasi antar perangkat.
