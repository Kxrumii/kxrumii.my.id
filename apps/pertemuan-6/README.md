# College Task Manager — Tugas PAW Pertemuan 6

Aplikasi pengelola tugas kuliah untuk Tugas PAW Pertemuan 6 (Git, npm, TypeScript, dan Vite). Aplikasi ini adalah salah satu workspace npm di monorepo `kxrumii.my.id` (`@kxrumii/pertemuan-6`) dan dikonfigurasi untuk menggunakan base path `/tugas/pertemuan-6/`.

## Status fitur

Aplikasi sedang dikembangkan secara bertahap. Dokumen ini hanya menjelaskan yang sudah ada di source.

**Sudah tersedia**

- Halaman statis (HTML semantik) dengan tampilan Editorial Task Ledger: header, ringkasan, dan daftar tugas.
- Model data tugas bertipe (`Task`, `TaskDraft`, `TaskStatus`) dan operasi murni untuk membuat, mengubah, mengganti status, menghapus, serta menghitung tugas (`src/tasks.ts`).
- Render daftar yang aman terhadap XSS: nilai tugas hanya ditulis lewat `textContent`, tanpa `innerHTML`.
- Keadaan awal berupa daftar kosong ("Belum ada tugas") dan ringkasan `0 tugas · 0 selesai`.
- **Tambah tugas** lewat dialog (`<dialog>` native): dari tombol "Tambah tugas pertama" pada keadaan kosong dan dari tombol "Tambah tugas" di header daftar jika sudah ada tugas.
- **Edit tugas** lewat tombol "Edit" pada setiap baris; dialog terisi nilai saat ini, `id` dan status tugas dipertahankan.
- **Validasi form**: judul dan mata kuliah wajib diisi (setelah di-trim); tenggat opsional (kosong menjadi `null`) dan, jika diisi, harus tanggal kalender valid berformat `YYYY-MM-DD`. Pesan kesalahan terhubung ke field lewat `aria-describedby`/`aria-invalid`, dan fokus pindah ke field tidak valid pertama. Tidak ada batas panjang, syarat tenggat di masa depan, maupun keunikan judul.
- Dialog dapat ditutup dengan tombol Batal atau Escape tanpa mengubah data; fokus dikembalikan ke pemicu (tombol tambah atau tombol Edit baris yang sama). Pada layar sempit dialog tampil sebagai panel dari bawah; animasinya dimatikan pada `prefers-reduced-motion`.
- **Ubah status** lewat checkbox pada setiap baris (Belum selesai ⇄ Selesai); label status dan ringkasan jumlah langsung diperbarui, fokus tetap pada checkbox tugas yang sama, dan judul tugas selesai tetap terbaca (dicoret tipis, kontras dijaga).
- **Hapus tugas** lewat tombol "Hapus" pada setiap baris dengan dialog konfirmasi (`<dialog>` native). Hapus hanya terjadi setelah konfirmasi eksplisit; Batal dan Escape tidak menghapus. Fokus kembali ke tombol Hapus tugas yang sama saat batal, atau ke tugas terdekat (atau tombol "Tambah tugas pertama" bila daftar kosong) setelah hapus. Judul tugas di dialog ditulis sebagai teks literal.
- **Penyimpanan di `localStorage`** (kunci `kxrumii:pertemuan-6:tasks:v1`). Format berupa envelope bernomor versi, `{ "version": 1, "tasks": [...] }`, bukan array polos. Data disimpan setelah setiap aksi yang mengubah data (tambah, edit yang benar-benar berubah, ubah status, hapus) dan dipulihkan sebelum render pertama. Ini penyimpanan lokal di peramban yang sama, bukan sinkronisasi backend atau cadangan cloud.
- **Validasi data tersimpan**: isi `localStorage` diperlakukan sebagai data tidak tepercaya. Setiap record harus punya `id` bilangan bulat positif yang unik, `title` dan `course` tidak kosong, `deadline` `null` atau tanggal kalender `YYYY-MM-DD` yang valid, dan `status` tepat `'belum-selesai'` atau `'selesai'`. Record tidak valid atau ber-`id` ganda dilewati (jumlahnya dilaporkan) dan record valid lainnya tetap dipulihkan; tidak ada nilai yang ditebak atau dikoreksi otomatis.
- **Kegagalan penyimpanan**: JSON rusak, struktur envelope salah, atau versi tidak didukung membuat daftar dimulai kosong dengan pesan peringatan yang terlihat, dan data lama **tidak ditimpa saat pemuatan**; data baru baru menimpanya ketika pengguna mengubah data. Bila `localStorage` tidak dapat diakses atau penulisan gagal (misalnya kuota penuh), aplikasi tetap dapat dipakai di memori dan menampilkan peringatan bahwa perubahan tidak tersimpan; peringatan hilang setelah penyimpanan berikutnya berhasil. Belum ada tombol reset atau sinkronisasi antar-tab.
- Umpan balik singkat untuk perubahan status dan hapus (animasi ringan dan pengumuman `aria-live`), dimatikan pada `prefers-reduced-motion`.
- Unit test untuk operasi tugas murni dan validasi form.
- Integrasi Shared Transition Bridge (transisi antarhalaman dari/ke Portal `/tugas/`).

**Belum tersedia (direncanakan)**

- Filter Semua / Belum selesai / Selesai.
- Penjelasan teknis di dalam halaman (Git, npm, TypeScript, Vite, environment variables).

## Teknologi

- TypeScript `^7.0.2` (mode `strict`, hanya pemeriksaan tipe lewat `tsc --noEmit`)
- Vite `^8.3.8` (dev server dan production build)
- Vanilla TypeScript, tanpa framework UI dan tanpa library runtime selain `@kxrumii/transition-bridge` (workspace internal, versi `0.4.0`)
- Test runner bawaan Node.js (`node:test`)
- npm workspaces (`npm@12.2.3` menurut `packageManager` di root)

## Prasyarat dan setup

- Node.js `26.13.1` (lihat `.nvmrc`; `engines` root mensyaratkan `>=26.13.1`)
- npm `12.2.3`

Dari root repository:

```bash
nvm use          # opsional, jika memakai nvm
npm ci           # memasang dependensi seluruh workspace
```

## Perintah npm

Dari root repository:

| Perintah | Fungsi |
|---|---|
| `npm run dev:t6` | Menjalankan dev server Task 6 (`vite --host 127.0.0.1`). Buka `http://127.0.0.1:5173/tugas/pertemuan-6/` (port default Vite; lihat output terminal). |
| `npm run check` | Pemeriksaan tipe seluruh workspace (`tsc --noEmit`). |
| `npm run build` | Build penuh: bersihkan output, build semua aplikasi Vite, lalu build Astro ke `dist/`. |
| `npm run preview` | Preview hasil build Astro (jalankan `npm run build` lebih dulu). |

Khusus workspace Task 6:

| Perintah | Fungsi |
|---|---|
| `npm run check --workspace=@kxrumii/pertemuan-6` | Pemeriksaan tipe Task 6 saja. |
| `npm run test --workspace=@kxrumii/pertemuan-6` | Menjalankan unit test (`node --test "tests/**/*.test.ts"`). |
| `npm run build --workspace=@kxrumii/pertemuan-6` | Pemeriksaan tipe lalu `vite build` untuk Task 6 saja. |

## Environment variables

File `.env.example` di folder ini adalah template konfigurasi non-rahasia yang ikut di-commit. File `.env` lokal **tidak** di-commit (diabaikan oleh `.gitignore`).

Membuat konfigurasi lokal (dari folder `apps/pertemuan-6/`):

```bash
cp .env.example .env
```

Variabel yang dibaca aplikasi (`src/main.ts`, tipe di `src/vite-env.d.ts`):

| Variabel | Fungsi | Nilai bawaan jika kosong |
|---|---|---|
| `VITE_APP_NAME` | Judul aplikasi pada halaman | `College Task Manager` |
| `VITE_APP_VERSION` | Versi yang ditampilkan pada halaman | `1.0.0` |

> **Peringatan:** semua variabel berawalan `VITE_` disisipkan ke dalam bundle dan dapat dibaca siapa pun di browser. Jangan pernah mengisinya dengan password, API key, token, atau data rahasia lain. Gunakan hanya untuk konfigurasi publik seperti nama atau versi aplikasi.

## Struktur source

```text
apps/pertemuan-6/
├── index.html          # Shell statis semantik, <template> baris tugas, empty state, <dialog> tambah/edit
├── package.json        # Scripts dan dependensi workspace
├── tsconfig.json       # Konfigurasi TypeScript (include: src)
├── vite.config.ts      # base, plugin bootstrap transisi, output build
├── .env.example        # Template environment variables (non-rahasia)
├── src/
│   ├── main.ts         # Inisialisasi, state tugas di memori, wiring tombol/dialog, menandai page-ready
│   ├── types.ts        # Tipe data tugas dan label status
│   ├── tasks.ts        # Operasi tugas murni (tanpa DOM) dan format tenggat
│   ├── render.ts       # Render DOM aman (textContent), helper requireElement
│   ├── validation.ts   # Validasi dan normalisasi input form (murni, tanpa DOM)
│   ├── task-dialog.ts  # Controller dialog tambah/edit: validasi, pesan kesalahan, fokus
│   ├── delete-dialog.ts # Controller dialog konfirmasi hapus (guard konfirmasi ganda, fokus)
│   ├── storage.ts      # Baca/simpan localStorage: envelope versi, validasi runtime, pesan kegagalan
│   ├── transition.ts   # Pemasangan Shared Transition Bridge
│   ├── style.css       # Gaya halaman dan variabel gerak transisi
│   └── vite-env.d.ts   # Tipe variabel environment
└── tests/
    ├── tasks.test.ts       # Unit test untuk src/tasks.ts
    ├── validation.test.ts  # Unit test untuk src/validation.ts dan alur validasi + operasi tugas
    └── storage.test.ts     # Unit test untuk src/storage.ts (Storage palsu yang di-inject)
```

`src/transition.ts` terkait integrasi bridge bersama dan tidak terkait logika task manager.

## Model data

Didefinisikan di `src/types.ts`:

- `TaskStatus` — union `'belum-selesai' | 'selesai'`.
- `Task` — `{ id: number; title: string; course: string; deadline: string | null; status: TaskStatus }`. `deadline` berformat `YYYY-MM-DD` atau `null`.
- `TaskDraft` — `{ title, course, deadline }`, data input sebelum menjadi `Task`.
- `TaskList` — `readonly Task[]`.

`src/tasks.ts` berisi fungsi murni yang tidak memutasi input: `createTask`, `updateTask`, `toggleStatus`, `removeTask`, `nextId`, `countByStatus`, `formatDeadline`, `parseCalendarDate`, `survivorId` (tugas terdekat untuk target fokus setelah hapus), dan generic `updateById<T extends { id: number }>`.

`src/storage.ts` menambahkan `loadTasks`, `saveTasks`, `isTask` (validasi runtime), dan `StorageLike` (subset `Storage` yang di-inject agar bisa diuji tanpa browser).

`src/validation.ts` menambahkan `RawTaskDraft` (string mentah dari form), `Result<T, E>` (union diskriminasi `ok: true | false`), `DraftErrors`, serta `validateDraft` yang mengembalikan `TaskDraft` yang sudah di-trim dan dinormalkan atau daftar pesan kesalahan per field. Logika yang sama dipakai oleh mode tambah dan edit.

## Pengujian

Unit test (`tests/tasks.test.ts`, `tests/validation.test.ts`, dan `tests/storage.test.ts`) memakai `node:test` dan `node:assert/strict`, dijalankan Node.js langsung pada file `.ts`. Cakupan: pembuatan id, pembuatan/pembaruan/penghapusan tugas, pembalikan status dua arah beserta hitungan per status, `survivorId`, generic `updateById`, penanganan nilai teks berbahaya sebagai string biasa, `formatDeadline`, penyimpanan (envelope, JSON rusak, versi tidak didukung, tiap aturan validasi record, id ganda, campuran valid/tidak valid, `getItem`/`setItem` yang melempar error, round-trip), serta validasi (judul/mata kuliah kosong atau hanya spasi, tenggat kosong, tanggal kalender tidak ada seperti `2026-02-30`, format salah, trim, dan pelestarian `id`/status saat edit). Folder `tests/` berada di luar `include` TypeScript sehingga tidak ikut `tsc` maupun bundle.

Checkbox status, dialog, fokus, dan pencegahan XSS pada lapisan render (`src/render.ts`, `src/task-dialog.ts`, `src/delete-dialog.ts`) belum memiliki test otomatis di repository; pemeriksaannya dilakukan di browser.

## Output build

`vite.config.ts` menetapkan `base: '/tugas/pertemuan-6/'` dan menulis hasil build ke `public/tugas/pertemuan-6/` di root repository (folder ini di-ignore Git). Saat `npm run build` di root, Astro menyalinnya ke `dist/tugas/pertemuan-6/`, yang menjadi URL publik `/tugas/pertemuan-6/`.
