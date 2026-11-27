# kxrumii.my.id

Ini website pribadiku. Isinya profil, eksperimen-eksperimen kecil, dan tugas kuliah yang aku kerjain sambil belajar. Dibikin pakai Astro dan terus kutambah-tambah seiring aku nemu hal baru.

Di repo yang sama ada juga aplikasi untuk mata kuliah **Pengembangan Aplikasi Web (PAW)**. Tiap tugas kupisah supaya bisa pakai teknologi dan konfigurasi yang cocok buat masing-masing.

**Website:** [kxrumii.my.id](https://kxrumii.my.id/)

## Isi repository

### Website utama

Website personal yang dibangun dengan Astro, Tailwind CSS, dan GSAP. Di sini ada halaman utama, profil, dan halaman yang menghubungkan semua tugas serta eksperimen.

### Tugas PAW

| Pertemuan | Teknologi | Isi |
|---|---|---|
| 01 | HTML5, Tailwind CSS | Halaman profil diri dengan HTML5 semantik |
| 06 | TypeScript, Vite | Aplikasi pengelola daftar tugas kuliah |
| 07 | React, TypeScript, Vite | Portofolio galeri spiral |
| 08 | React Router, TypeScript, Vite | Aplikasi multi-halaman dengan routing |
| 09 | React, TypeScript, Vite | Project showroom 2.5D |

Source code tiap tugas ada di folder `apps/` masing-masing.

## Teknologi

- **Astro** untuk website utama.
- **Tailwind CSS** buat styling.
- **GSAP** buat animasi dan interaksi visual.
- **React** buat antarmuka berbasis komponen.
- **TypeScript** buat semua aplikasi berbasis JavaScript.
- **Vite** sebagai dev server dan build tool aplikasi tugas.
- **React Router** buat navigasi antarhalaman.
- **npm Workspaces** supaya banyak aplikasi bisa hidup dalam satu repo.

## Menjalankan project

Pastikan Node.js dan npm sudah terpasang. Project ini pakai Node.js `26.13.1` dan npm `12.2.3`.

Clone repo lalu masuk ke foldernya:

```bash
git clone https://github.com/Kxrumii/kxrumii.my.id.git
cd kxrumii.my.id
```

Aktifkan versi Node.js yang dipakai project, lalu install dependency:

```bash
nvm use
npm ci
```

### Development

Website utama:

```bash
npm run dev
```

Aplikasi tugas dijalankan satu-satu:

```bash
npm run dev:t1
npm run dev:t6
npm run dev:t7
npm run dev:t8
npm run dev:t9
```

Tiap aplikasi punya dev server sendiri, jadi nggak perlu menyalakan yang lain.

### Build

Cek TypeScript dulu, baru build semuanya:

```bash
npm run check
npm run build
```

Hasil build ada di folder `dist/`. Mau lihat hasilnya di lokal:

```bash
npm run preview
```

### Favicon

Favicon situs dibuat dari satu skrip, jadi bentuknya selalu sama di semua tempat:

```bash
npm run favicons
```

Skrip ini (`scripts/build-favicons.mjs`, butuh ImageMagick `magick` di PATH untuk file `.ico`) menghasilkan `public/favicon.svg`, `public/favicon.ico`, dan ikon data-URI untuk Task 6 (aplikasi dan halaman dokumentasi) serta Task 7, semuanya dari path logo "F" tanda tangan yang sama. Halaman daftar tugas (`/tugas/`) juga pakai favicon ini. Halaman utama tetap punya F monospace hijaunya sendiri.

## Struktur repository

```text
kxrumii.my.id/
├── apps/
│   ├── pertemuan-1/
│   ├── pertemuan-6/
│   ├── pertemuan-7/
│   ├── pertemuan-8/
│   └── pertemuan-9/
├── docs/
│   └── deployment/
├── public/
├── scripts/
├── src/
├── .github/
│   └── workflows/
├── .nvmrc
├── package.json
└── package-lock.json
```

Website utama ada di `src/`, sedangkan source code aplikasi tugas ada di `apps/`. Folder `public/tugas/` dibuat otomatis waktu build, jadi nggak perlu diisi manual.

## Halaman website

| URL | Halaman |
|---|---|
| `/` | Beranda |
| `/profil/` | Profil diri |
| `/tugas/` | Arsip tugas PAW |
| `/tugas/pertemuan-1/` | Tugas HTML5 |
| `/tugas/pertemuan-6/` | Aplikasi TypeScript |
| `/tugas/pertemuan-7/` | Portofolio React (galeri spiral) |
| `/tugas/pertemuan-8/` | Aplikasi React Router |
| `/tugas/pertemuan-9/` | Project Showroom 2.5D (React) |

## Deployment

Production-nya jalan di home server pribadi. Hasil build statis disajikan Nginx, dan Cloudflare Tunnel yang menyambungkan server ke domain publik.

Build nggak kujalankan di server karena hardware dan toolchain-nya kurang cocok. Servernya Intel Core i3-3210 (Ivy Bridge) dengan RAM 8 GB dan nggak mendukung AVX2. Waktu dicoba, salah satu komponen native compiler Astro (`@astrojs/compiler-rs`) kena `Illegal instruction` di server, padahal build yang sama jalan lancar di laptop. Penyebab pastinya belum ketemu, tapi cukup jelas bahwa server ini belum cocok buat toolchain build yang kupakai sekarang.

Jadi build kulakukan di laptop atau GitHub Actions runner. Hasilnya berupa file statis yang dikirim ke server dan disajikan Nginx. Dengan begitu server nggak perlu kompilasi apa-apa dan fokus melayani website.

Source code dan perubahan disimpan di GitHub. GitHub Actions juga menjalankan pengecekan otomatis tiap ada pull request.

## Catatan

Project ini masih berkembang, dan sebagian tugas juga belum final. Isi dan fiturnya bisa berubah seiring aku belajar hal baru di kuliah dan di web.
