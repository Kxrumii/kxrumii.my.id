# PAW Task 7 — Portofolio Spiral (React + Vite)

Portofolio karya video/motion dengan galeri **spiral 3D** dan mode **list**, dibangun dengan **React 19 + Vite 8 +
TypeScript (strict) + React Router 7**. Aplikasi berjalan di `basename="/tugas/pertemuan-7"` sebagai workspace npm
`@kxrumii/pertemuan-7` (hasil build ke `public/tugas/pertemuan-7/`).

Tata letak, interaksi, dan sistem visualnya meniru portofolio Pacôme Pertant (pacomepertant.com), dan halaman About
menyebut rujukan itu. Yang **tidak** disalin dari situs tersebut: logo, nama, bio, gambar atau thumbnail proyek,
showreel, dan font berlisensi (Indivisible/Typekit). Penggantinya: monogram sendiri, data dari `src/data/`, sampul
generatif, dan Inter Tight (SIL OFL). Seluruh isi karya dan profil saat ini masih **data contoh** (`isSample: true`).

## Fitur

| Bagian | Isi |
|---|---|
| Loader | Hitungan 0–100 (menunggu font), lalu pilihan **enter with sound** / **enter without sound**. Klik pilihan ini adalah gesture yang boleh menyalakan audio. Panel lalu naik keluar. |
| Chrome tetap | Logo (kiri atas; saat hover muncul tag miring), switch **spiral • list** (tengah atas), tombol **menu** yang membesar menjadi panel putih (kanan atas), kartu *featured* miring dengan teks berjalan mengikuti `offset-path` (kiri bawah), dan tombol suara (kanan bawah). |
| Spiral | Heliks vertikal CSS 3D (`perspective`, `preserve-3d`, `rotateY`/`translateZ`), **tanpa WebGL**. Bisa digerakkan dengan wheel/trackpad, drag, atau tombol panah; ada inersia, snap ke kartu terdekat, dan drift pelan saat diam. Daftar pendek diulang di sepanjang heliks tanpa mengubah urutan. |
| List | Judul besar di tengah. Saat hover, judul lain meredup dan sampul mengikuti kursor. |
| Proyek `/work/:slug` | Judul besar, meta (kategori, tahun, peran; "—" bila kosong), sampul atau video YouTube (iframe baru dimuat setelah klik), ringkasan, catatan, tautan, dan proyek berikutnya. |
| About | Pernyataan besar dengan sampul karya diselipkan di antara kata, tautan sosial, dan kredit. |
| Suara | Satu `AudioContext` yang dibuat lazy dari gesture. SFX dan ambient pad sepenuhnya prosedural (tidak ada file audio). Audio di-suspend saat mati atau saat tab tersembunyi. |

## Bukti React

- **Komponen + props:** `PillButton`, `RollingLabel`, `WorkCover`, `SocialLinks`, `ViewSwitch`, `Menu`, `FeaturedBadge`,
  `SpiralView`, `ListView`, dan halaman-halaman di `src/pages/`.
- **State:** `entered` dan `menuOpen` (`Layout`), view `?view=list` (`WorksPage`), karya aktif (`SpiralView`), karya
  yang di-hover (`ListView`), video yang diputar (`ProjectPage`), fase loader (`Loader`), suara (`useSyncExternalStore`).
- **Event handler:** wheel, pointer drag, keyboard (panah/Enter/Escape), hover, dan klik.
- **Conditional rendering:** loader, menu, video vs sampul, kontak hanya muncul bila profil bukan sampel, dan 404.
- **List rendering dengan key:** kartu spiral, baris list, meta, sosial, dan potongan teks About.

## Struktur

```text
src/
  App.tsx, main.tsx, transition.ts, types.ts
  audio/       sound.ts (engine), useSound.ts
  components/  Layout, Loader, Logo, ViewSwitch, Menu, FeaturedBadge, SoundButton, SpiralView, ListView, ...
  data/        works.ts, profile.ts (data contoh)
  hooks/       usePageTitle, useReducedMotion
  pages/       WorksPage, ProjectPage, AboutPage, NotFoundPage
  spiral/      geometry.ts (murni, dites), useSpiral.ts (fisika + input)
  styles/      tokens, base, loader, chrome, works, pages, motion
  utils/       works.ts, interleave.ts
tests/         spiral.test.ts, works.test.ts (node --test)
```

## Aksesibilitas dan performa

- `prefers-reduced-motion`: spiral tidak memakai loop animasi (langkah langsung lompat), marquee disembunyikan, dan
  transisi dipersingkat.
- Kartu spiral bersifat dekoratif (`aria-hidden`). Region spiral bisa difokus (panah, Enter), dan caption memuat satu
  link nyata ke karya aktif.
- Menu: fokus pindah ke panel saat dibuka dan kembali ke tombol saat ditutup; Escape dan klik di luar menutupnya.
- Opacity kartu ditulis ke elemen daun (`--o`), bukan ke kartu `preserve-3d`, supaya 3D tidak diratakan.

## Menjalankan

```bash
npm run check --workspace=@kxrumii/pertemuan-7   # tsc --noEmit
npm test --workspace=@kxrumii/pertemuan-7        # node --test (geometri spiral, data, interleave)
npm run build --workspace=@kxrumii/pertemuan-7
npm run dev --workspace=@kxrumii/pertemuan-7 -- --port 5177 --strictPort
```

**Deploy (Nginx):** aplikasi ini SPA dengan `basename`, jadi permintaan langsung ke `/tugas/pertemuan-7/about` atau
`/work/<slug>` perlu fallback:

```nginx
location = /tugas/pertemuan-7 { return 301 /tugas/pertemuan-7/; }
location /tugas/pertemuan-7/ { try_files $uri $uri/ /tugas/pertemuan-7/index.html; }
```

## Sebelum publikasi

1. Isi `src/data/profile.ts` dan `src/data/works.ts` dengan data nyata (judul, tahun, peran, sampul, YouTube ID), lalu
   set `isSample: false`. Jangan menebak data.
2. Ganti video demo YouTube publik pada entri 01.
3. Opsional: ganti teks badge "featured" jika nanti ada showreel sungguhan.
