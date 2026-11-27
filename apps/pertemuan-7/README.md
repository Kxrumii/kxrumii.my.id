# PAW Task 7 — Interactive Project Showroom (React + Vite)

Catatan teknis pengumpulan Task 7. Dokumen ini sengaja tidak menyebut judul karya: seluruh isi karya dan profil hanya
ada di `src/data/` (saat ini masih **data contoh**, ditandai `isSample: true`), sehingga README tetap valid setelah data
nyata diisi. Judul kerja visual: *Afterimage Archive* (belum final sebagai nama).

## 1. Gambaran umum

Showroom interaktif untuk karya video/moving image, dibangun dengan **React 19 + Vite 8 + TypeScript (strict) +
React Router 7**. Aplikasi berjalan di `basename="/tugas/pertemuan-7"` dan menjadi workspace npm `@kxrumii/pertemuan-7`
di monorepo (hasil build ke `public/tugas/pertemuan-7/`).

Halaman utama punya dua mode atas satu sumber data (`src/data/works.ts`):

- **Gallery** (default): ruang CSS 2.5D layar penuh. Karya adalah fokus; tidak ada indeks atau panel samping permanen.
  Kamera mengikuti koreografi yang sudah ditulis (bukan acak, bukan free-roam).
- **List**: baris bernomor dengan pencarian dan filter kategori. Nomor proyek hanya muncul di sini.

Tanpa WebGL, Three.js, atau dependensi 3D: hanya DOM, CSS 3D (`perspective`, `preserve-3d`), SVG, WAAPI, dan
`requestAnimationFrame`.

| Rute | Komponen | Isi |
|---|---|---|
| `/` | `pages/WorksStage` | Gallery atau List, view toggle |
| `/work/:slug` | `components/WorkSheet` | Detail karya sebagai `<dialog>` modal di atas Works (child route dari `WorksStage`) |
| `/playground` | `pages/PlaygroundPage` | Eksperimen / tes editing / proses (tidak diubah) |
| `/about` | `pages/AboutPage` | Pernyataan singkat dan identitas (nama, NIM) |
| `/contact` | — | Dialihkan (`replace`) ke `/about`; halaman Contact sudah dihapus |
| `*` | `pages/NotFoundPage` | 404 |

Di luar rute ada **gerbang suara** (`SoundGate`, sekali per sesi) dan shell tetap (`AppShell`): rail, navigasi, jam
lokal, identitas (Nama + NIM), `SoundToggle`.

## 2. Kontrol Gallery

| Masukan | Perilaku |
|---|---|
| Tanpa masukan | Autoplay: kamera berhenti (HOLD) pada karya, lalu menjalankan satu gerakan tetap ke karya berikutnya |
| Scroll / drag | Men-scrub progres kamera secara kontinu, maju dan mundur (bukan satu karya per event) |
| Sebelumnya / Berikutnya (tombol, `←` `→`) | Satu gerakan kamera utuh ke karya tetangga; masukan cepat diantre maksimal satu |
| Hover atau fokus keyboard pada karya aktif saat HOLD | Menjeda kamera; keluar melanjutkan dari posisi tersimpan setelah jeda singkat |
| Tombol Jeda / `Spasi` | Jeda manual; tidak dibatalkan oleh hover |
| Detail terbuka, mode List, tab tersembunyi, transisi rute | Kamera berhenti dan dilanjutkan dari posisi yang sama |
| `prefers-reduced-motion` | Kamera statis; Sebelumnya/Berikutnya berpindah langsung tanpa animasi |

Roda gulir tidak menginterupsi gerakan Sebelumnya/Berikutnya yang sedang berjalan: satu niat scroll disimpan (dibatasi)
dan diterapkan setelah gerakan selesai.

## 3. Peta komponen

Semua di `src/components/` kecuali disebut lain.

| Komponen | Tanggung jawab | Dipakai di |
|---|---|---|
| `AppShell` | Kerangka: gerbang, rail, nav, identitas, `<Outlet/>`, transisi antar-stage | `App` |
| `SoundGate` | Pilihan masuk dengan/tanpa suara ("first frame") | `AppShell` |
| `ShellRail`, `ShellNav`, `LocalClock` | Rail kiri, nav desktop, jam | `AppShell` |
| `MenuSheet` | Menu `<dialog>` untuk layar < 900 px | `AppShell` |
| `TransitionLink` ★ | Link router yang memicu transisi halaman | `ShellNav`, `MenuSheet`, `NotFoundPage` |
| `SoundToggle` ★ | Tombol suara on/off | `AppShell`, `MenuSheet`, `WorkSheet` |
| `StatusBadge` ★ | Lencana "Sample" / "Featured" / "Sample data" | `WorkRow`, `WorkSheet`, `AboutPage`, `PlaygroundPage` |
| `MetaList` ★ | Daftar `dt/dd` (peran, tahun, dst.) | `WorkSheet`, `AboutPage`, `AppShell` (identitas) |
| `DisclosurePanel` ★ | Panel tampil/sembunyi (`aria-expanded`) | `WorkSheet`, `PlaygroundPage` |
| `Stage` | Bingkai konten rute (judul, eyebrow, atribut transisi) | `AboutPage`, `PlaygroundPage`, `NotFoundPage` |
| `GalleryView` | Ruang 2.5D: menyusun anchor, display, fragmen, HUD | `WorksStage` |
| `WorkDisplay` ★ | Satu karya di ruang (box, hover morph, tautan ke detail) | `GalleryView` (satu per karya) |
| `FilmFragments`, `AtmosphereLayer` | Partikel potongan film deterministik; grain, debu, light leak | `GalleryView` |
| `GalleryControls`, `FocusCaption` | Sebelumnya / Jeda / Berikutnya; keterangan karya fokus (tanpa nomor) | `GalleryView` |
| `FilterBar`, `ViewToggle` | Pencarian + chip kategori (List); pilih gallery/list | `WorksStage` |
| `ListView` → `WorkList` → `WorkRow` | Daftar bernomor | `WorksStage` |
| `EmptyState` | Hasil filter kosong | `WorksStage` |
| `VideoEmbed` | Fasad video ↔ iframe ↔ tautan ↔ kosong | `WorkSheet` |
| `WordReveal` | Teks muncul per kata | `AboutPage` |

★ = dipakai ulang atau muncul berulang. Pendukung: `data/` (satu-satunya sumber konten), `utils/filterWorks.ts`,
`utils/cardFace.ts` (wajah gradien sementara dari `slug`), `audio/` (mesin suara), `motion/`, `showroom/`, `transition.ts`.

## 4. Props, state, dan event

```
WorksStage (query, category, view, activeSlug)
 ├─ FilterBar (List)   props: query, onQueryChange, category, onCategoryChange, categories, resultCount
 ├─ ViewToggle         props: view, onChange
 ├─ GalleryView        props: works, initialSlug, suspended (detail terbuka), onFocusChange
 │   ├─ WorkDisplay    props: work, width, height, active, interactive, reducedMotion, onHoverEnter, onHoverLeave
 │   ├─ FilmFragments  props: fragments, scale, register
 │   ├─ GalleryControls props: paused, reducedMotion, disabled, onPrev, onNext, onTogglePause
 │   └─ FocusCaption   props: work, phase
 └─ ListView → WorkList → WorkRow   props: works, activeSlug, onActivate (+ index)
```

| State | Lokasi | Fungsi |
|---|---|---|
| `query`, `category`, `view`, `activeSlug` | `WorksStage` (`useState`) | Filter, mode, karya aktif; hasil filter diturunkan, bukan disimpan |
| `ui` (fokus, fase, pemilik kontrol, jeda) | `useShowroom` (`useState`) | Hanya perubahan semantik; koordinat kamera ditulis langsung ke DOM, bukan lewat state |
| `size`, `profileId` | `useShowroom` | Skala adegan dan profil koreografi (landscape/portrait) |
| `playing` | `VideoEmbed` | Video diputar (di-`key` per karya) |
| `open` | `DisclosurePanel`, `MenuSheet` | Panel / menu terbuka |
| `gate` | `AppShell` (+ `sessionStorage`) | Gerbang suara terbuka / keluar / selesai |
| audio `enabled/ducked` | `audio/soundEngine` via `useSyncExternalStore` | Preferensi suara (`localStorage` kunci `t7:sound`) |

Event: klik (toggle, tombol galeri, panel, gerbang), `change` (pencarian), keyboard (`←` `→`, `Spasi`, `↑` `↓` pada
List, `Esc` pada dialog), pointer (hover/fokus karya, drag), `wheel`, `visibilitychange`.

## 5. Pemetaan ke rubrik

- **Komponen reusable**: lihat §3 (`TransitionLink`, `SoundToggle`, `StatusBadge`, `MetaList`, `DisclosurePanel`,
  `WorkDisplay`, dan lainnya), masing-masing di berkas sendiri.
- **Props**: pohon di §4 (parent → child, tanpa prop drilling dalam).
- **State**: `useState` di `WorksStage`, `useShowroom`, `VideoEmbed`, `DisclosurePanel`, `MenuSheet`, `AppShell`.
- **Event handling**: §4.
- **List rendering (`map()` + `key` stabil)**: `GalleryView` (key `slug`), `FilmFragments` (key `id`), `WorkList`
  (key `slug`), `PlaygroundPage` (key `id`), `FilterBar`, `ShellNav`/`MenuSheet`, `MetaList`, `ViewToggle`.
- **Conditional rendering**: Gallery vs List; pesan galat bila koreografi tidak cocok dengan data; thumbnail vs gradien;
  tombol Jeda disembunyikan saat reduced motion; `EmptyState`; badge `Sample`/`Featured`; empat keluaran `VideoEmbed`;
  `SoundGate` hanya pada sesi baru; slug tak dikenal pada `WorkSheet`; 404.
- **Fitur interaktif (> 3)**: pencarian dan filter (List); toggle Gallery/List; kontrol Gallery (scroll, drag,
  Sebelumnya/Berikutnya, Jeda, hover/fokus); detail karya dengan URL yang dapat dibagikan; video setelah diklik;
  panel catatan; suara opsional.
- **Nama dan NIM**: ditampilkan di shell dan About; masih placeholder sampai data nyata diisi di `src/data/profile.ts`.

## 6. Arsitektur

**Camera Choreography** (`src/showroom/`) — perpindahan antar-karya. Data deklaratif dan deterministik, terpisah dari
urutan data karya: `camera.ts` (pose, segmen, easing), `choreography.ts` (profil landscape dan portrait; urutan cue,
ID segmen, dan durasi sama di keduanya), `timeline.ts` (`sceneAt(t)` murni: pose kamera, fokus, fase HOLD/TRANSIT),
`cameraTransform.ts`. Karya yang tampak kecil lalu membesar adalah efek perspektif/kedalaman kamera. Semua angka
koreografi masih **placeholder** yang perlu disetel secara visual.

**Shape Morph** (`src/motion/morphShapes.ts` murni, `morphRunner.ts` WAAPI) — sistem terpisah untuk hover/fokus, buka dan
tutup Detail, dan transisi About. Hanya menulis `clip-path` pada elemen mask daun; media tidak pernah di-stretch. Tidak
pernah berjalan hanya karena kamera berpindah antar-karya.

**Kepemilikan properti** (satu penulis per properti per elemen): renderer kamera menulis `transform` pada
`.showroom-camera` serta `opacity` anchor; Shape Morph menulis `clip-path`; FLIP detail (`motion/sheetMotion.ts`) menulis
transform di dalam dialog; Transition Bridge memiliki siklus hidup rute dan kunci interaksi.

**Controller dan transport**: `controller.ts` adalah reducer murni (kepemilikan masukan, prioritas, antrean intent);
`transport.ts` adalah satu-satunya master timeline (detik). Saat ini sumber waktunya jam senyap (`performance.now()`).
**Musik sebagai master timeline belum diimplementasikan**: `musicCueMap.ts` baru berisi model dan validasi; aset musik
yang legal dan cue manualnya belum tersedia. Suara yang ada hanya SFX prosedural (Web Audio, tanpa berkas).

**Transition Bridge**: `src/transition.ts` mendaftarkan `pageId: 'task-7'`; transisi antar-stage memakai mode "depth"
untuk wilayah Gallery. Canvas: dari warna pendaratan Portal (`#10110f`) ke Cinema Black (`#0c0c0d`); aplikasi hanya
dark.

**Responsif**: profil `portrait` (aspek < 0,8 atau lebar < 600 px, dengan histeresis) dan `landscape` memakai koordinat
dan framing yang ditulis terpisah; layout shell berpindah di 900 px.

**Deploy (Nginx)**: ini SPA dengan `basename`; permintaan langsung ke `/tugas/pertemuan-7/about` atau `/work/<slug>`
butuh fallback ke `/tugas/pertemuan-7/index.html`:
```nginx
location = /tugas/pertemuan-7 { return 301 /tugas/pertemuan-7/; }
location /tugas/pertemuan-7/ { try_files $uri $uri/ /tugas/pertemuan-7/index.html; }
```

## 7. Menjalankan dan memverifikasi

Prasyarat: Node `v26.13.1`, npm `12.2.3` (workspace; jalankan perintah root dari akar repo).

```bash
npm run check --workspace=@kxrumii/pertemuan-7   # tsc --noEmit
npm test --workspace=@kxrumii/pertemuan-7        # node --test (logika murni: kamera, timeline, transport, controller, morph)
npm run check                                    # semua workspace
npm run build                                    # build semua aplikasi + Astro (menulis public/tugas/, dist/)
npm run verify:transition                        # bootstrap transisi tunggal di setiap dokumen aplikasi
npm run dev --workspace=@kxrumii/pertemuan-7 -- --port 5177 --strictPort
```

Dev server tersedia di `http://127.0.0.1:5177/tugas/pertemuan-7/`. Di preview mandiri, prefetch ke portal `/tugas/`
akan 404 karena portal Astro tidak ikut dilayani; itu tidak terjadi di produksi.

**Yang sudah diuji di browser**: skenario kontrol Gallery, detail, About, List, dan reduced motion di Chromium (Brave
headless, lewat skrip), termasuk framing pada lebar 1440, 1100, 768, dan 390 px. **Belum diuji**: Firefox, perangkat
mobile nyata (gesture touch, Safari iOS), tab tersembunyi sungguhan, dan pengukuran performa di perangkat nyata.

## 8. Mengganti data contoh

Edit `src/data/profile.ts` dan `works.ts` (serta `playground.ts`), lalu set `isSample: false`. Koreografi kamera
(`showroom/choreography.ts`) ditulis untuk lima karya contoh: jumlah dan urutan karya yang berbeda memerlukan
koreografi baru (Gallery menampilkan pesan galat dan List tetap berfungsi). Jangan menebak tahun, peran, atau judul.
