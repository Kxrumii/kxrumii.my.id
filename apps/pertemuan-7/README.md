# PAW Task 7 — Personal Creative Portfolio (React + Vite)

Catatan teknis pengumpulan Task 7. Dokumen ini sengaja tidak menyebut judul karya: seluruh isi karya, profil, dan
eksperimen hanya ada di `src/data/` (saat ini masih **data contoh**, ditandai `isSample: true`), sehingga README tetap
valid setelah data nyata diisi.

## 1. Gambaran umum

Portofolio kreatif satu halaman-aplikasi (SPA) untuk karya video, dibangun dengan **React 19 + Vite 8 + TypeScript
(strict) + React Router 7**. Aplikasi berjalan di `basename="/tugas/pertemuan-7"` dan menjadi workspace npm
`@kxrumii/pertemuan-7` di monorepo (hasil build ke `public/tugas/pertemuan-7/`).

Alur halaman (`src/App.tsx`):

| Rute | Komponen | Isi |
|---|---|---|
| `/` | `pages/WorksStage` | Indeks karya: mode **Spiral** (CSS 3D) atau **List**, filter, pencarian, info karya aktif, numeral indeks |
| `/work/:slug` | `components/WorkSheet` | Detail karya sebagai `<dialog>` modal di atas Works (child route dari `WorksStage`) |
| `/playground` | `pages/PlaygroundPage` | Eksperimen / tes editing / proses |
| `/about` | `pages/AboutPage` | Profil (nama, NIM, peran, fokus), `WordReveal` |
| `/contact` | `pages/ContactPage` | Email (salin ke clipboard) dan tautan sosial |
| `*` | `pages/NotFoundPage` | 404 |

Di luar rute ada **gerbang suara** (`SoundGate`, sekali per sesi) dan shell tetap (`AppShell`): rail, navigasi, jam lokal,
identitas (Nama + NIM), email, `SoundToggle`.

## 2. Peta komponen

Semua di `src/components/` kecuali disebut lain.

| Komponen | Tanggung jawab | Dipakai di |
|---|---|---|
| `AppShell` | Kerangka: gerbang, rail, nav, identitas, `<Outlet/>`, transisi antar-stage | `App` |
| `SoundGate` | Pilihan masuk dengan/tanpa suara | `AppShell` |
| `ShellRail`, `ShellNav`, `LocalClock` | Rail kiri, nav desktop, jam | `AppShell` |
| `MenuSheet` | Menu `<dialog>` untuk layar <900 px | `AppShell` |
| `TransitionLink` ★ | Link router yang memicu transisi halaman | `ShellNav`, `MenuSheet`, `NotFoundPage` |
| `SoundToggle` ★ | Tombol suara on/off | `AppShell`, `MenuSheet`, `WorkSheet` |
| `StatusBadge` ★ | Lencana "Sample" / "Featured" / "Sample data" | `WorkInfo`, `WorkRow`, `WorkSheet`, `AboutPage`, `PlaygroundPage` |
| `MetaList` ★ | Daftar `dt/dd` (peran, tahun, video, dst.) | `WorkInfo`, `WorkSheet`, `AboutPage`, `AppShell` (identitas) |
| `DisclosurePanel` ★ | Panel tampil/sembunyi (`aria-expanded`) | `WorkSheet` (catatan produksi), `PlaygroundPage` |
| `CopyEmailButton` ★ | Salin email + status terumumkan | `ContactPage`, `MenuSheet`, `AppShell` |
| `Stage` | Bingkai konten rute (judul, eyebrow, atribut transisi) | `AboutPage`, `PlaygroundPage`, `ContactPage`, `NotFoundPage` |
| `FilterBar`, `ViewToggle` | Pencarian + chip kategori; pilih spiral/list | `WorksStage` |
| `WorkInfo`, `IndexNumeral` | Metadata karya aktif; numeral raksasa `01 /05` | `WorksStage` |
| `SpiralView` (+ `hooks/useSpiral`) | Helix 3D, fisika scroll/drag/drift | `WorksStage` |
| `ListView` → `WorkList` → `WorkRow` | Daftar karya | `WorksStage` |
| `EmptyState` | Hasil filter kosong | `WorksStage` |
| `VideoEmbed` | Fasad video ↔ iframe ↔ tautan ↔ kosong | `WorkSheet` |
| `WordReveal` | Teks muncul per kata | `AboutPage` |

★ = dipakai ulang di lebih dari satu tempat. Pendukung: `data/` (satu-satunya sumber konten), `utils/filterWorks.ts`
(filter murni), `utils/cardFace.ts` (wajah gradien kartu dari `slug`), `audio/` (mesin suara), `motion/`, `transition.ts`.

## 3. Aliran props, state, dan event

**Props mengalir parent → child**, tanpa prop-drilling dalam: `WorksStage` memegang state dan membagikannya.

```
WorksStage (query, category, view, activeSlug)
 ├─ FilterBar      props: query, onQueryChange, category, onCategoryChange, categories, resultCount
 ├─ ViewToggle     props: view, onChange
 ├─ WorkInfo       props: work (karya aktif)
 ├─ IndexNumeral   props: index, total
 └─ SpiralView | ListView→WorkList→WorkRow
                   props: works (hasil filter), activeSlug, onActivate, paused (sheet terbuka)
```

State (`useState` kecuali disebut lain):

| State | Lokasi | Fungsi |
|---|---|---|
| `query`, `category` | `WorksStage` | Filter; hasil = `filterWorks(works, query, category)` (diturunkan, bukan disimpan) |
| `view` (`'spiral' \| 'list'`) | `WorksStage` | Mode tampilan |
| `activeSlug` | `WorksStage` | Karya aktif; jika terfilter, karya pertama yang terlihat mengambil alih |
| `playing` | `VideoEmbed` | Video sedang diputar (di-`key` per karya, tidak bocor antar karya) |
| `open` | `DisclosurePanel`, `MenuSheet` | Panel / menu terbuka |
| `state` (`idle/copied/failed`) | `CopyEmailButton` | Status salin, kembali `idle` setelah 2 dtk |
| `gate` | `AppShell` | Gerbang suara terbuka / keluar / selesai (+ `sessionStorage` di `shell/gate.ts`) |
| `now` | `LocalClock` | Jam lokal |
| audio `enabled/ducked` | `audio/soundEngine` via `useSyncExternalStore` | Preferensi suara (`localStorage` kunci `t7:sound`) |
| `ShellContext` (`locked`) | `shell/shellContext.ts` | Memberi tahu halaman bahwa gerbang masih terkunci |

Event handler:

- **Form/klik:** `onChange` (input pencarian), `onClick` (chip kategori, toggle view, panah spiral, salin email, play video,
  buka/tutup panel, gerbang suara).
- **Keyboard:** `←` / `→` memindah kartu spiral (`SpiralView`); `↑` / `↓` memindah fokus antar baris list (`WorkList`);
  `Esc` menutup `WorkSheet` / `MenuSheet` (event `cancel` pada `<dialog>` dicegat agar URL ikut kembali); `Tab` terkunci di
  dalam dialog; `Enter` membuka karya.
- **Pointer:** wheel, drag/swipe, dan hover pada spiral (`hooks/useSpiral`); hover/fokus baris list mengaktifkan karya.

## 4. Pemetaan ke rubrik

**List rendering (`map()` + `key` stabil)** — key selalu `slug` / `id` / nilai unik, bukan indeks array untuk data:
`SpiralView.tsx` (`works.map`, key `work.slug`), `WorkList.tsx` (key `work.slug`), `PlaygroundPage.tsx`
(`playgroundItems.map`, key `item.id`), `FilterBar.tsx` (chip kategori), `ShellNav.tsx` / `MenuSheet.tsx` (`navItems`),
`MetaList.tsx`, `ContactPage.tsx` (`profile.socials`), `ViewToggle.tsx`. Kunci berbasis indeks hanya dipakai untuk elemen
dekoratif tetap (digit numeral, kata `WordReveal`).

**Conditional rendering** — cabang nyata:

1. Hasil filter kosong → `EmptyState` dengan tombol reset (`WorksStage`); satu karya terfilter tetap tampil.
2. Badge `Sample` / `Featured` / `Sample data` hanya jika `isSample` / `featured` (`WorkInfo`, `WorkRow`, `WorkSheet`,
   `AboutPage`, `PlaygroundPage`).
3. `VideoEmbed` (4 keluaran): fasad/thumbnail (belum ada request ke YouTube) → iframe `youtube-nocookie` setelah klik →
   tautan eksternal jika tanpa video → "video belum tersedia".
4. Panel produksi `DisclosurePanel`: konten tampil/sembunyi dengan `aria-expanded`; catatan kosong → "Catatan belum diisi".
5. Slug tidak ditemukan → `WorkSheet` menampilkan "Karya tidak ditemukan" (judul dokumen ikut berubah).
6. Rute tak dikenal → `NotFoundPage` (404).
7. Gerbang suara → `SoundGate` hanya selama sesi baru; shell `inert` selagi terkunci.
8. Nilai `null` (tahun, peran, thumbnail) → teks "Belum diisi" / gradien `cardFace`, tidak pernah menebak.
9. `prefers-reduced-motion` → jalur tanpa animasi (lihat §5).

**Fitur interaktif (> 3)**

1. Filter kategori + pencarian teks (judul, ringkasan, kategori, tahun) dengan hitungan hasil langsung.
2. Spiral 3D: scroll, drag/swipe, `←`/`→`, tombol sebelumnya/berikutnya, drift otomatis yang berhenti saat hover/fokus.
3. Toggle Spiral ↔ List dengan transisi.
4. `WorkSheet` modal: animasi buka/tutup dari kartu/baris (FLIP), `Esc`, klik backdrop, URL `/work/:slug` dapat dibagikan,
   Back/Forward berfungsi.
5. Video: fasad → pemutar `youtube-nocookie` hanya setelah diklik.
6. Panel catatan produksi (disclosure) di sheet dan Playground.
7. Salin email ke clipboard dengan status terumumkan dan fallback `mailto:`.
8. Suara prosedural opt-in (gerbang, `SoundToggle`), pad ambient turun otomatis saat video diputar.
9. Menu mobile, jam lokal, navigasi keyboard penuh.

## 5. Arsitektur tambahan

- **`transition-bridge`**: `src/transition.ts` mendaftarkan `pageId: 'task-7'` dan menyerahkan hand-off antar-dokumen
  (portal ↔ aplikasi); transisi antar-stage di dalam SPA (Works ↔ Playground ↔ About ↔ Contact) memakai durasi dari
  `styles/motion.css` (±350–550 dtk). Bootstrap disisipkan Vite (`scripts/vite-transition-bootstrap.mjs`) dan diverifikasi
  `npm run verify:transition`.
- **Web Audio prosedural (opt-in)**: tanpa berkas audio; `AudioContext` baru dibuat setelah pilihan pengguna; ada
  `duck/unduck` saat video diputar.
- **`prefers-reduced-motion`**: tanpa loop `requestAnimationFrame` (spiral melompat per langkah), tanpa animasi CSS,
  tidak ada elemen yang tertahan di `opacity: 0`.
- **Responsif**: breakpoint utama 900 px (layout desktop ↔ satu kolom) dengan penyesuaian 600–899 dan 900–1099 px; diuji di
  1440×900, 1100×800, 1024×768, 768×1024, 409×846 tanpa tabrakan komponen dan tanpa overflow horizontal.
- **Aksesibilitas**: `:focus-visible`, kontras ≥ 4,5:1 (label di atas gradien kartu dipilih per baris di `cardFace`),
  dialog dengan fokus terkunci, `role="status"` untuk status salin.
- **Deploy (Nginx)**: ini SPA dengan `basename`; permintaan langsung ke `/tugas/pertemuan-7/about`, `/work/<slug>`, dll.
  butuh fallback ke `/tugas/pertemuan-7/index.html`, misalnya:
  ```nginx
  location = /tugas/pertemuan-7 { return 301 /tugas/pertemuan-7/; }
  location /tugas/pertemuan-7/ { try_files $uri $uri/ /tugas/pertemuan-7/index.html; }
  ```
  Tanpa aturan ini rute selain `/` menghasilkan 404 saat dimuat langsung atau di-refresh.

## 6. Menjalankan dan memverifikasi

Prasyarat: Node `v26.13.1`, npm `12.2.3` (workspace; jalankan perintah root dari akar repo).

```bash
# dari akar repo
npm run check               # tsc --noEmit semua workspace (skrip `check` ada di tiap workspace)
npm run build               # build semua aplikasi + Astro (menulis public/tugas/, dist/)
npm run verify:transition   # bootstrap transisi tunggal di setiap dokumen aplikasi

# hanya Task 7
npm run dev:t7                                                    # skrip root; port bawaan Vite, TANPA 5177
npm run dev --workspace=@kxrumii/pertemuan-7 -- --port 5177 --strictPort   # port khusus 5177
npm run preview --workspace=@kxrumii/pertemuan-7 -- --port 5177 --strictPort  # bundle produksi (setelah build)
```

Dev/preview mandiri mengakses `http://127.0.0.1:5177/tugas/pertemuan-7/`. Di preview mandiri, prefetch ke portal `/tugas/`
akan 404 karena portal Astro tidak ikut dilayani; itu tidak terjadi di produksi.

## 7. Mengganti data contoh

Edit hanya `src/data/profile.ts`, `works.ts`, `playground.ts`, lalu set `isSample: false`. Nama/NIM/email berasal dari satu
sumber (`profile.ts`). Jangan menebak tahun, peran, atau judul.
