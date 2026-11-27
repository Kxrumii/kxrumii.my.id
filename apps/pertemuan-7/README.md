# PAW Task 7 — Portofolio Spiral Fahrii (React + Vite)

Portofolio **Fahrii (developer & editor)** dengan galeri **spiral 3D** dan mode **list**, dibangun dengan **React 19 +
Vite 8 + TypeScript (strict) + React Router 7**. Aplikasi berjalan di `basename="/tugas/pertemuan-7"` sebagai workspace
npm `@kxrumii/pertemuan-7` (hasil build ke `public/tugas/pertemuan-7/`).

Tata letak, interaksi, dan sistem visualnya meniru portofolio Pacôme Pertant (pacomepertant.com), dan halaman About
mencantumkan rujukan itu. Yang **tidak** disalin dari situs tersebut: logo, nama, bio, gambar atau thumbnail proyek,
showreel, font berlisensi (Indivisible/Typekit), dan file suaranya. Semua isi (8 karya, intro About, tautan sosial)
adalah milik owner.

## Fitur

| Bagian | Isi |
|---|---|
| Gate | Hitungan 0–100, lalu berubah menjadi logo **F kaligrafi** (huruf ditulis seperti dengan pena bermata lebar sehingga tebal-tipisnya alami, dan "ditulis" goresan demi goresan saat hitungan mencapai 100) dengan teks "Fahrii ✳ portfolio / developer & editor", lalu pilihan **enter with sound** / **enter without sound**. Latarnya transparan sehingga trail ASCII sudah terlihat. Setelah memilih, teks larut dan logo F terbang (FLIP) ke kiri atas; bintang muncul menyebar dari titik itu, lalu chrome dan spiral masuk bertahap. Tidak ada panel yang naik. |
| Background | Satu canvas 2D permanen (bukan WebGL) dengan tiga lapis: **pixel stars** (berkelip bertingkat pada tick 16 fps, ada bintang jatuh), **ASCII wake** (jejak karakter yang mengikuti kursor; panjang dan terangnya sesuai kecepatan), dan **ripple** saat klik di area kosong. |
| Chrome | Logo F (kiri atas, tag "Fahrii" saat hover), switch **spiral • list**, tombol **menu** yang membesar menjadi panel putih dengan ikon sosial yang sama seperti footer Pertemuan 1, dan tombol suara. Di halaman proyek, menu memberi tempat untuk tombol close, dan logo serta tombol suara berbalik warna (`mix-blend-mode: difference`). |
| Spiral | Heliks vertikal CSS 3D. Bisa digerakkan dengan wheel, drag, atau panah; ada inersia dan snap. Hanya sisi depan heliks yang terlihat, dan jaraknya dijamin **tanpa overlap** (lihat Tes). Caption karya aktif ada di **kiri bawah**, rata kiri. |
| List | Judul rata tengah; index dan kategori di **atas** judul. Saat hover, judul lain meredup dan sampul mengikuti kursor. |
| Spiral ↔ list | Saat berpindah, kartu mengecil menjauh (stagger dari depan) atau judul naik keluar dari mask, lalu tampilan baru masuk. |
| Proyek `/work/:slug` | Mengikuti tata letak rujukan: kartu putih dengan tombol close, preview setinggi layar berupa **loop bisu** karya, judul 5 kolom + deskripsi 3 kolom dengan reveal, dan styleframes kiri/kanan yang membesar saat di-scroll. Setelah itu ada layar **next project** dengan tag "see the case" / "scroll". **Terus scroll di dasar** halaman untuk membuka karya berikutnya; **terus scroll ke atas di puncak** halaman untuk membuka karya sebelumnya (pil "previous · judul" + bar), dan halaman sebelumnya terbuka di bagian dasarnya. Ada cooldown setelah tiba agar momentum trackpad tidak berantai. Transisinya fade + geser + skala, dengan arah sesuai next/prev, tanpa wipe yang berkedip. |
| Player | Overlay layar penuh ala rujukan: poster blur di belakang, video dalam bingkai sesuai rasio aslinya, dan pil kontrol putih (play/pause, mute, scrubber 4 still, close). Videonya embed YouTube *nocookie* tanpa kontrol bawaan, dikendalikan lewat `postMessage` (`video/youtubeBridge.ts`), tanpa script tambahan. Iframe sengaja lebih tinggi dari bingkai lalu dipotong, sehingga judul, "More videos", dan logo YouTube jatuh di luar area terlihat. Tombol: Space/K, M, ←/→, Esc. Musik diam selama player terbuka. |
| About | Pernyataan besar dengan sampul di sela kata, tautan sosial (ikon + handle), dan kredit. |
| Suara | Satu `AudioContext` lazy. BGM **Shelter** di-loop penuh dengan crossfade 2 detik; SFX prosedural untuk hover, klik, menu, switch, trail, ripple, bintang muncul, bintang jatuh, dan next. |

## Musik (Shelter) — file TIDAK ada di repo

"Shelter (Official Piano Version)" (Porter Robinson & Madeon) adalah file milik owner yang **tidak pernah di-commit**.

- **Development:** taruh file di `apps/pertemuan-7/local-media/shelter.webm`. Folder ini di-exclude lewat
  `.git/info/exclude`.
- **Production:** aplikasi memutar `/tugas/pertemuan-7/media/shelter.webm` **hanya jika** owner menaruh file itu sendiri
  di server (`<webroot>/tugas/pertemuan-7/media/shelter.webm`). Pastikan proses deploy (mis. `rsync --delete`) tidak
  menghapusnya.
- Bila file tidak ada (404, atau SPA mengembalikan `index.html`), status musik menjadi `unavailable`: situs tetap
  berjalan tanpa musik dan hanya SFX yang berbunyi.

## Karya dan media

- **Data:** `src/data/works.ts` berisi 8 karya. Judul diambil dari judul YouTube/nama file, dengan koreksi owner. Lima
  karya ada di YouTube; tiga (ILUSI GARIS KEMISKINAN, Rahmatan Lil Alamin, Sundays) menunggu link unlisted dan
  sementara menampilkan "video segera hadir". Tahun, peran, dan deskripsi masih kosong ("—" / "deskripsi menyusul").
- **Still (di-commit, ~1.2 MB):** `public/works/<slug>/{cover,f1,f2,f3}.webp` dibuat oleh `tools/media.mjs` dari file
  lokal. Skrip mengambil 11 titik waktu lalu memilih frame yang paling detail, jadi tidak pernah frame hitam.
- **Preview loop (TIDAK di-commit):** loop bisu 6 detik 720p di `local-media/previews/<slug>.mp4` (~0.2–1.6 MB per
  karya). Di production, upload ke `<webroot>/tugas/pertemuan-7/media/previews/<slug>.mp4`. Bila file tidak ada,
  preview menampilkan sampul.
- **Membuat ulang:** `node apps/pertemuan-7/tools/media.mjs`, atau `--stills` untuk still saja. Butuh `ffmpeg`.
- **Menambah link unlisted:** isi argumen `youtubeVideoId` karya tersebut di `works.ts`.

## Bukti React

- **Komponen + props:** `LogoMark`, `SocialIcon`, `SocialLinks`, `PillButton`, `RollingLabel`, `WorkCover`, `StarField`,
  `SpiralView`, `ListView`, `ViewSwitch`, `Menu`, `Loader`, `project/*`.
- **State:**
  - `Layout`: fase `gate → entering → entered`, origin bintang, `menuOpen`
  - `WorksPage`: view + fase keluar
  - `SpiralView`: karya aktif
  - `ListView`: karya yang di-hover
  - `ProjectPreview`: video
  - `Loader`: fase
  - suara: lewat `useSyncExternalStore`
- **Event handler:** wheel, pointer (drag/trail/ripple), keyboard, touch, hover, dan klik.
- **Conditional rendering:** gate, menu per route, video vs sampul, styleframes, kontak, 404.
- **List rendering dengan key:** kartu spiral, baris list, ikon sosial, styleframes, dan potongan teks About.

## Struktur

```text
src/
  audio/       sound.ts (engine + SFX), music.ts (Shelter), loopPlan.ts (jadwal crossfade, murni)
  background/  pixelStars.ts (adaptasi @uicapsule), asciiWake.ts, ripple.ts (semua murni)
  components/  Layout, Loader, StarField, Logo/LogoMark, Menu, SocialLinks/SocialIcon, SpiralView, ListView, project/...
  data/        works.ts (contoh), profile.ts
  pages/       WorksPage, ProjectPage, AboutPage, NotFoundPage
  spiral/      geometry.ts (pose + proyeksi layar, murni), useSpiral.ts
  styles/      tokens, base, background, loader, chrome, works, pages, motion
  utils/       works.ts, interleave.ts, nextProgress.ts
  video/       youtubeBridge.ts (protokol postMessage YouTube, murni)
tools/         media.mjs (still + preview dari local-media, ffmpeg)
tests/         spiral, works, background, loopPlan, nextProgress, edge, youtubeBridge (node --test)
```

## Tes

- **Spiral tanpa overlap:** `projectCard()` memproyeksikan setiap kartu yang terlihat dengan rantai transform yang
  sama dengan CSS (konstanta kamera hanya ada di `geometry.ts`; hook menuliskannya ke DOM). Uji separating-axis
  memastikan tidak ada dua kartu yang beririsan pada 4 ukuran viewport, 4 jumlah karya, dan 97 posisi.
- **Background:** densitas, grid 5 px, regenerasi 15%, twinkle bertingkat, bintang jatuh, trail yang meluruh dan
  dibatasi, serta ripple. Semua dengan RNG ber-seed.
- **Loop musik:** setiap fade-in bertepatan dengan fade-out sebelumnya, dan kurvanya equal-power.
- **Next progress:** normalisasi wheel, akumulasi, pengurasan, dan deteksi dasar halaman.

## Menjalankan

```bash
npm run check --workspace=@kxrumii/pertemuan-7
npm test --workspace=@kxrumii/pertemuan-7
npm run build --workspace=@kxrumii/pertemuan-7
npm run dev --workspace=@kxrumii/pertemuan-7 -- --port 5177 --strictPort
```

**Deploy (Nginx):** aplikasi ini SPA dengan `basename`, jadi butuh fallback:

```nginx
location = /tugas/pertemuan-7 { return 301 /tugas/pertemuan-7/; }
location /tugas/pertemuan-7/ { try_files $uri $uri/ /tugas/pertemuan-7/index.html; }
```

## Sebelum publikasi

1. Tambahkan link unlisted untuk tiga karya yang belum ada di YouTube, serta tahun/peran/deskripsi bila ingin.
2. Upload `media/shelter.webm` dan `media/previews/*.mp4` ke server (keduanya di luar git).
