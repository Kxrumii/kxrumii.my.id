import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tugas/pertemuan-1/',
  plugins: [tailwindcss()],
  build: {
    outDir: fileURLToPath(
      new URL('../../public/tugas/pertemuan-1/', import.meta.url),
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
