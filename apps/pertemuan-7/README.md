# PAW Task 7: Showreel Fahrii (React + Vite)

Ini showreel-ku sebagai editor, tempat aku nunjukin karya editan. Ada galeri **spiral 3D** dan mode **list**, dibangun dengan **React 19 + Vite 8 + TypeScript (strict) + React Router 7**. Aplikasinya jalan di `basename="/tugas/pertemuan-7"` sebagai workspace npm `@kxrumii/pertemuan-7`, dan hasil build-nya masuk ke `public/tugas/pertemuan-7/`.

Tata letak, interaksi, dan sistem visualnya kuambil dari gaya portofolio Pacôme Pertant (pacomepertant.com), dan halaman About menyebut rujukan itu. Yang nggak kusalin dari situs tersebut: logo, nama, bio, gambar atau thumbnail proyek, showreel, font berlisensi (Indivisible/Typekit), dan file suaranya. Semua isinya (9 karya, intro About, tautan sosial) punyaku sendiri.

## Fitur

| Bagian | Isi |
|---|---|
| Gate | Hitungan 0 sampai 100, lalu berubah jadi logo **F tanda tangan**. Hurufnya punya bar atas yang bergelombang, batang yang melingkar di bawah lalu mengayun balik melintang, dan palang pendek. Logonya "ditulis" goresan demi goresan saat hitungan mencapai 100. Di bawahnya ada teks "Fahrii ✳ portfolio / developer & editor", lalu pilihan **enter with sound** atau **enter without sound**. Latarnya transparan, jadi trail ASCII sudah kelihatan. Setelah memilih, teks larut dan logo F terbang (FLIP) ke kiri atas. Bintang muncul menyebar dari titik itu, lalu chrome dan spiral masuk bertahap. Nggak ada panel yang naik. |
| Background | Satu canvas 2D permanen (bukan WebGL) dengan tiga lapis: **pixel stars** (berkelip bertingkat pada tick 16 fps, ada bintang jatuh), **ASCII wake** (jejak karakter yang mengikuti kursor, panjang dan terangnya tergantung kecepatan), dan **ripple** saat klik di area kosong. |
| Chrome | Logo F di kiri atas (tag "Fahrii" muncul saat hover), switch **spiral • list**, tombol **menu** yang membesar jadi panel putih dengan ikon sosial yang sama kayak footer Pertemuan 1, dan tombol suara. Di halaman proyek, menu memberi tempat buat tombol close, dan logo serta tombol suara berbalik warna (`mix-blend-mode: difference`). |
| Spiral | Heliks vertikal dengan CSS 3D. Bisa digerakkan pakai wheel, drag, atau panah, dan ada inersia serta snap. Cuma sisi depan heliks yang kelihatan, dan jaraknya dijamin **nggak overlap** (lihat bagian Tes). Caption karya aktif ada di **kiri bawah**, rata kiri. |
| List | Judul rata tengah, dengan index dan kategori di **atas** judul. Saat hover, judul lain meredup dan sampul mengikuti kursor. |
| Spiral ↔ list | Waktu pindah, kartu mengecil menjauh (stagger dari depan) atau judul naik keluar dari mask, baru tampilan berikutnya masuk. |
| Proyek `/work/:slug` | Tata letaknya mengikuti rujukan: kartu putih dengan tombol close, preview setinggi layar berupa **loop bisu** karya, judul 5 kolom plus deskripsi 3 kolom dengan reveal, dan styleframes kiri/kanan yang membesar saat di-scroll. Sesudahnya ada layar **next project** dengan tag "see the case" / "scroll". **Terus scroll di dasar** halaman untuk buka karya berikutnya, atau **terus scroll ke atas di puncak** halaman untuk buka karya sebelumnya (pil "previous · judul" plus bar). Halaman sebelumnya terbuka di bagian dasarnya. Ada cooldown setelah tiba supaya momentum trackpad nggak berantai. Transisinya fade + geser + skala, arahnya menyesuaikan next/prev, dan nggak ada wipe yang berkedip. |
| Player | Overlay layar penuh ala rujukan: poster blur di belakang, video dalam bingkai sesuai rasio aslinya, dan pil kontrol putih (play/pause, mute, scrubber 4 still, close). Videonya embed YouTube *nocookie* tanpa kontrol bawaan, dikendalikan lewat `postMessage` (`video/youtubeBridge.ts`), tanpa script tambahan. Iframe sengaja dibuat lebih tinggi dari bingkai lalu dipotong, jadi judul, "More videos", dan logo YouTube jatuh di luar area yang kelihatan. Tombolnya: Space/K, M, ←/→, Esc. Musik diam selama player terbuka. |
| About | Intro singkat soal situs ini (sampul karya terselip di sela kata), tautan sosial (ikon + handle), dan kredit. |
| Suara | Satu `AudioContext` lazy. BGM **Shelter** di-loop penuh dengan crossfade 2 detik. SFX-nya prosedural, buat hover, klik, menu, switch, trail, ripple, bintang muncul, bintang jatuh, dan next. |

## Logo dan favicon

Logo F tanda tangan digambar dari path di `src/logo/signature.ts`. Path yang sama dipakai buat animasi tulis di gate, logo di chrome, dan favicon Task 7. Halaman lain pakai favicon halaman utama (huruf F monospace hijau). Semua favicon dibuat dengan `npm run favicons` dari root repo (`scripts/build-favicons.mjs`, butuh ImageMagick `magick` untuk file `.ico`).

## Musik (Shelter): file-nya nggak ada di repo

"Shelter (Official Piano Version)" (Porter Robinson & Madeon) itu file punyaku dan nggak pernah di-commit.

- **Development:** taruh file di `apps/pertemuan-7/local-media/shelter.webm`. Foldernya sudah di-exclude lewat `.git/info/exclude`.
- **Production:** aplikasi memutar `/tugas/pertemuan-7/media/shelter.webm` hanya kalau aku sendiri menaruh file itu di server (`<webroot>/tugas/pertemuan-7/media/shelter.webm`). Pastikan proses deploy (misalnya `rsync --delete`) nggak menghapusnya.
- Kalau file nggak ada (404, atau SPA mengembalikan `index.html`), status musik jadi `unavailable`. Situsnya tetap jalan tanpa musik dan cuma SFX yang bunyi.

## Karya dan media

- **Data:** `src/data/works.ts` berisi 9 karya. Judulnya diambil dari judul YouTube atau nama file, lalu kukoreksi. Enam karya ada di YouTube. Tiga lainnya (ILUSI GARIS KEMISKINAN, Rahmatan Lil Alamin, Sundays) masih menunggu link unlisted, jadi sementara menampilkan "video segera hadir".
- **Detail karya:** deskripsinya kutulis sendiri. Tahun masih kosong (`null`) kecuali A Signal From Outer Space (2024). Kategorinya `mograph`, `edit`, `film` (Rahmatan Lil Alamin), dan `video` (ILUSI GARIS KEMISKINAN, UIN ONE FOR ALL).
- **Sampul (di-commit):** `public/works/<slug>/cover.webp`. Untuk karya yang ada di YouTube, sampulnya adalah thumbnail YouTube (maxres, atau sd/hq dengan letterbox dipotong jadi 16:9). Sisanya diambil dari frame videonya.
- **Styleframes (di-commit):** `public/works/<slug>/f1.webp` dan seterusnya. Cara pilihnya, berurutan: gambar sendiri di `local-media/frames/<slug>/` (png, jpg, atau webp, diurutkan berdasarkan nama) menang duluan. Kalau nggak ada, dipakai timestamp di array `frames` pada daftar WORKS di `tools/media.mjs`. Kalau itu juga kosong, skrip memilih tiga momen paling detail dari 11 titik waktu, jadi nggak pernah frame hitam. Karya yang nggak punya video lokal tapi ada di YouTube (UIN ONE FOR ALL) pakai frame otomatis YouTube (hq1–hq3) yang dipotong jadi 16:9, dan nggak punya loop preview (`preview: false`). Kalau jumlah styleframe sebuah karya bukan 3, set `frames: n` di `src/data/works.ts`.
- **Preview loop (nggak di-commit):** loop bisu 6 detik 720p di `local-media/previews/<slug>.mp4` (sekitar 0,2 sampai 1,6 MB per karya). Di production, upload ke `<webroot>/tugas/pertemuan-7/media/previews/<slug>.mp4`. Kalau file nggak ada, preview menampilkan sampul.
- **Membuat ulang:** `node apps/pertemuan-7/tools/media.mjs`. Flag yang tersedia: `--stills` (sampul dan styleframe saja), `--covers` (cuma thumbnail YouTube, nggak butuh video lokal), dan `--only <slug>` (satu karya saja, bisa digabung dengan flag lain). Butuh `ffmpeg`. Video sumbernya ada di `local-media/`, yang nggak ikut git.
- **Menambah link unlisted:** isi `youtubeVideoId` karya itu di `works.ts`, terus tambahin `youtube: '<id>'` di daftar WORKS `tools/media.mjs` biar sampulnya ikut pakai thumbnail YouTube (`--covers --only <slug>`).

## Bukti React

- **Komponen + props:** `LogoMark`, `SocialIcon`, `SocialLinks`, `PillButton`, `RollingLabel`, `WorkCover`, `StarField`, `SpiralView`, `ListView`, `ViewSwitch`, `Menu`, `Loader`, `project/*`.
- **State:**
  - `Layout`: fase `gate → entering → entered`, origin bintang, `menuOpen`
  - `WorksPage`: view dan fase keluar
  - `SpiralView`: karya aktif
  - `ListView`: karya yang di-hover
  - `ProjectPreview`: video
  - `Loader`: fase
  - suara: lewat `useSyncExternalStore`
- **Event handler:** wheel, pointer (drag/trail/ripple), keyboard, touch, hover, dan klik.
- **Conditional rendering:** gate, menu per route, video atau sampul, styleframes, kontak, 404.
- **List rendering dengan key:** kartu spiral, baris list, ikon sosial, styleframes, dan potongan teks About.

## Struktur

```text
src/
  audio/       sound.ts (engine + SFX), music.ts (Shelter), loopPlan.ts (jadwal crossfade, murni)
  background/  pixelStars.ts (adaptasi @uicapsule), asciiWake.ts, ripple.ts (semua murni)
  components/  Layout, Loader, StarField, Logo/LogoMark, Menu, SocialLinks/SocialIcon, SpiralView, ListView, project/...
  data/        works.ts, profile.ts
  logo/        signature.ts (path logo F, dipakai juga buat favicon)
  pages/       WorksPage, ProjectPage, AboutPage, NotFoundPage
  spiral/      geometry.ts (pose + proyeksi layar, murni), useSpiral.ts
  styles/      tokens, base, background, loader, chrome, works, pages, motion
  utils/       works.ts, interleave.ts, nextProgress.ts
  video/       youtubeBridge.ts (protokol postMessage YouTube, murni)
tools/         media.mjs (still + preview, ffmpeg), timestamp.mjs (parser timestamp)
tests/         spiral, works, background, loopPlan, nextProgress, edge, youtubeBridge, timestamp (node --test)
```

## Tes

Ada 62 tes yang lulus.

- **Spiral tanpa overlap:** `projectCard()` memproyeksikan setiap kartu yang kelihatan dengan rantai transform yang sama seperti di CSS (konstanta kamera cuma ada di `geometry.ts`, hook-nya yang menuliskan ke DOM). Uji separating-axis memastikan nggak ada dua kartu yang beririsan pada 4 ukuran viewport, 4 jumlah karya, dan 97 posisi.
- **Background:** densitas, grid 5 px, regenerasi 15%, twinkle bertingkat, bintang jatuh, trail yang meluruh dan dibatasi, serta ripple. Semuanya pakai RNG ber-seed.
- **Loop musik:** tiap fade-in tepat bertepatan dengan fade-out sebelumnya, dan kurvanya equal-power.
- **Next progress:** normalisasi wheel, akumulasi, pengurasan, dan deteksi dasar halaman.
- **Timestamp:** parser timestamp untuk `frames` di `tools/media.mjs`.

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

1. Koreksi draf detail karya (kategori, peran, ringkasan, catatan) dan isi tahunnya.
2. Tambahkan link unlisted untuk tiga karya yang belum ada di YouTube.
3. Upload `media/shelter.webm` dan `media/previews/*.mp4` ke server (keduanya di luar git).
