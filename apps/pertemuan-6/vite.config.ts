import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { transitionBootstrap } from '../../scripts/vite-transition-bootstrap.mjs';

export default defineConfig({
  base: '/tugas/pertemuan-6/',
  plugins: [transitionBootstrap()],
  build: {
    outDir: fileURLToPath(
      new URL('../../public/tugas/pertemuan-6/', import.meta.url),
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dokumentasi: fileURLToPath(new URL('./dokumentasi/index.html', import.meta.url)),
      },
    },
  },
});
