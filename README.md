# kxrumii.my.id

Personal website, portfolio, dan kumpulan tugas mata kuliah Pengembangan Aplikasi Web. Website utama menggunakan Astro, setiap tugas ditempatkan pada workspace terpisah sesuai teknologi yang diminta.

## Teknologi

- **Website utama:** Astro 7, Tailwind CSS v4, GSAP.
- **Pertemuan 1:** HTML5 semantik, CSS dengan Tailwind CSS, dan Vite sebagai build tool untuk halaman statis.
- **Pertemuan 6:** TypeScript + Vite (Vanilla).
- **Pertemuan 7:** React + TypeScript + Vite.
- **Pertemuan 8:** React + TypeScript + React Router + Vite.
- **Package manager:** npm workspaces.

## Persyaratan development

- Node.js 26.13.1 (lihat `.nvmrc`).
- npm 12.2.3 (lihat `packageManager` pada `package.json`).

Setelah memasang Node.js yang sesuai, aktifkan environment proyek dan install dependency:

```bash
nvm use
npm install
```

`npm install` digunakan saat pertama kali menambahkan workspace atau mengubah dependency. Setelah `package-lock.json` terbentuk dan sudah di-commit, gunakan `npm ci` untuk clean install.

## Menjalankan website dan aplikasi

```bash
# Website utama Astro
npm run dev

# Aplikasi tugas individual
npm run dev:t1
npm run dev:t6
npm run dev:t7
npm run dev:t8
```

Setiap aplikasi Vite menggunakan base path sesuai URL produksi, misalnya `/tugas/pertemuan-8/`.

## Build seluruh website

```bash
npm run check
npm run build
npm run preview
```

Urutan `npm run build`:

1. Membersihkan hasil build tugas sebelumnya dari `public/tugas/` dan `dist/`.
2. Menjalankan build workspace Pertemuan 1, 6, 7, dan 8 secara berurutan.
3. Setiap aplikasi Vite menulis hasil build ke `public/tugas/pertemuan-X/`.
4. Astro membangun website utama dan menyalin isi `public/` ke `dist/`.

Hasil akhirnya berada di `dist/` dan dapat disajikan Nginx.

## Struktur repository

```text
.
├── apps/
│   ├── pertemuan-1/       # Source HTML5 + CSS
│   ├── pertemuan-6/       # Vanilla TypeScript + Vite
│   ├── pertemuan-7/       # React + Vite
│   └── pertemuan-8/       # React Router + Vite
├── docs/
│   └── deployment/        # Catatan konfigurasi deployment/Nginx
├── public/
│   ├── favicon.svg
│   ├── foto-diri.png
│   └── tugas/             # Generated output; tidak di-commit
├── scripts/
│   └── clean-generated.mjs
├── src/                   # Website utama Astro
├── .github/workflows/     # CI GitHub Actions
├── package.json           # Root package dan npm workspaces
└── package-lock.json      # Satu lockfile untuk seluruh workspace
```

## URL aplikasi

- `/` — halaman utama Astro.
- `/profil/` — halaman profil dalam website Astro.
- `/tugas/` — indeks tugas.
- `/tugas/pertemuan-1/` — halaman HTML5.
- `/tugas/pertemuan-6/` — aplikasi TypeScript.
- `/tugas/pertemuan-7/` — aplikasi React.
- `/tugas/pertemuan-8/` — aplikasi React Router.

Pertemuan 8 menggunakan `BrowserRouter` dengan `basename` `/tugas/pertemuan-8`. Nginx memerlukan fallback ke `index.html` untuk direct visit dan refresh pada nested route. Snippet disimpan di `docs/deployment/nginx-spa-fallback.conf`; jangan diterapkan ke server sebelum artefak baru siap diuji.

## Environment variables

File `.env` tidak boleh di-commit. Tugas 6 menyediakan `.env.example` sebagai template konfigurasi non-rahasia. Variabel dengan prefix `VITE_` akan masuk ke bundle browser dan tidak boleh berisi password atau API key rahasia.

## Deployment

GitHub menjadi source of truth. Build dilakukan di laptop/CI, sedangkan Tarazuma menjadi production static host melalui Nginx dan Cloudflare Tunnel. Workflow GitHub Actions hanya menjalankan CI; deployment ke Tarazuma dilakukan terpisah setelah hasil build diverifikasi.
