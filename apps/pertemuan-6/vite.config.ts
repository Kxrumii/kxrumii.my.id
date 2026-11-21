import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tugas/pertemuan-6/',
  build: {
    outDir: fileURLToPath(
      new URL('../../public/tugas/pertemuan-6/', import.meta.url),
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
