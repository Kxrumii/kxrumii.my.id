import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { transitionBootstrap } from '../../scripts/vite-transition-bootstrap.mjs';

export default defineConfig({
  base: '/tugas/pertemuan-1/',
  plugins: [transitionBootstrap(), tailwindcss()],
  build: {
    outDir: fileURLToPath(
      new URL('../../public/tugas/pertemuan-1/', import.meta.url),
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
