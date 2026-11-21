# kxrumii.my.id

Website pribadi yang menjadi tempat untuk menampilkan profil, menyimpan berbagai eksperimen, dan mengembangkan tugas-tugas perkuliahan. Project ini dibuat menggunakan Astro dan terus dikembangkan seiring dengan hal-hal baru yang sedang dipelajari.

Selain website utama, repository ini juga berisi beberapa aplikasi untuk mata kuliah **Pengembangan Aplikasi Web (PAW)**. Setiap tugas dikembangkan secara terpisah agar bisa menggunakan teknologi dan konfigurasi yang sesuai dengan kebutuhan masing-masing.

**Website:** [kxrumii.my.id](https://kxrumii.my.id/)

## Isi Repository

### Website Utama

Website personal yang dibangun menggunakan Astro, Tailwind CSS, dan GSAP. Bagian ini mencakup halaman utama, profil, serta halaman yang menghubungkan berbagai tugas dan eksperimen.

### Tugas Pengembangan Aplikasi Web

| Pertemuan | Teknologi | Deskripsi |
|---|---|---|
| 01 | HTML5, Tailwind CSS | Halaman profil diri menggunakan HTML5 semantik |
| 06 | TypeScript, Vite | Aplikasi pengelolaan daftar tugas kuliah |
| 07 | React, TypeScript, Vite | Eksperimen UI berbasis komponen React |
| 08 | React Router, TypeScript, Vite | Aplikasi multi-halaman dengan sistem routing |

Source code setiap tugas berada di dalam direktori `apps/` masing-masing.

## Teknologi

Beberapa teknologi yang digunakan dalam project ini:

- **Astro** — framework untuk membangun website utama.
- **Tailwind CSS** — styling dan pengaturan tampilan.
- **GSAP** — animasi dan interaksi visual.
- **React** — pengembangan antarmuka berbasis komponen.
- **TypeScript** — bahasa pemrograman untuk aplikasi berbasis JavaScript.
- **Vite** — development server dan build tool untuk aplikasi tugas.
- **React Router** — pengaturan navigasi antarhalaman.
- **npm Workspaces** — pengelolaan beberapa aplikasi dalam satu repository.

## Menjalankan Project

Pastikan Node.js dan npm sudah terpasang. Project ini menggunakan Node.js `26.13.1` dan npm `12.2.3`.

Clone repository dan masuk ke direktori project:

```bash
git clone https://github.com/Kxrumii/kxrumii.my.id.git
cd kxrumii.my.id
```

Aktifkan versi Node.js yang digunakan project dan install dependency:

```bash
nvm use
npm ci
```

### Development

Untuk menjalankan website utama:

```bash
npm run dev
```

Untuk menjalankan aplikasi tugas secara individual:

```bash
npm run dev:t1
npm run dev:t6
npm run dev:t7
npm run dev:t8
```

Setiap aplikasi memiliki development server sendiri dan dapat dijalankan tanpa harus menjalankan aplikasi lainnya.

### Build

Untuk memeriksa TypeScript dan membangun seluruh aplikasi:

```bash
npm run check
npm run build
```

Hasil build tersedia di direktori `dist/`. Untuk melihat hasilnya secara lokal:

```bash
npm run preview
```

## Struktur Repository

```text
kxrumii.my.id/
├── apps/
│   ├── pertemuan-1/
│   ├── pertemuan-6/
│   ├── pertemuan-7/
│   └── pertemuan-8/
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

Website utama berada di `src/`, sedangkan source code aplikasi tugas disimpan di `apps/`. Direktori `public/tugas/` dihasilkan secara otomatis ketika proses build berlangsung.

## Halaman Website

Berikut beberapa halaman yang tersedia:

| URL | Halaman |
|---|---|
| `/` | Beranda |
| `/profil/` | Profil diri |
| `/tugas/` | Arsip tugas PAW |
| `/tugas/pertemuan-1/` | Tugas HTML5 |
| `/tugas/pertemuan-6/` | Aplikasi TypeScript |
| `/tugas/pertemuan-7/` | Aplikasi React |
| `/tugas/pertemuan-8/` | Aplikasi React Router |

## Deployment

Website ini menggunakan home server pribadi sebagai production host. Hasil build statis disajikan menggunakan Nginx, sedangkan Cloudflare Tunnel digunakan untuk menghubungkan server dengan domain publik.

Proses build tidak dijalankan langsung di server karena keterbatasan hardware dan kompatibilitas toolchain. Server ini menggunakan Intel Core i3-3210 (Ivy Bridge) dengan RAM 8 GB dan tidak mendukung AVX2. Dalam pengujian, salah satu komponen native compiler Astro (`@astrojs/compiler-rs`) mengalami `Illegal instruction` ketika dijalankan di server, sementara proses build yang sama berhasil dilakukan di laptop. Penyebab pasti crash tersebut belum dapat dipastikan, tetapi kondisi ini menunjukkan bahwa lingkungan server belum cocok untuk menjalankan toolchain build yang digunakan saat ini.

Karena itu, proses build dilakukan di laptop atau GitHub Actions runner yang memiliki lingkungan lebih sesuai. Hasilnya berupa file statis yang kemudian dikirim ke server untuk disajikan oleh Nginx. Dengan pemisahan ini, server tidak perlu menjalankan proses kompilasi dan dapat berfokus pada penyajian website.

GitHub digunakan untuk menyimpan source code dan mengelola perubahan. GitHub Actions juga menjalankan pemeriksaan otomatis setiap kali ada perubahan yang diajukan melalui pull request.

## Catatan

Project ini masih terus berkembang. Beberapa aplikasi tugas juga masih dalam tahap pengembangan, sehingga isi dan fiturnya dapat berubah seiring berjalannya perkuliahan dan eksperimen teknologi web.