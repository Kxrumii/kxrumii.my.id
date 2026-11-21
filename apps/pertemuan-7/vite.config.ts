import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tugas/pertemuan-7/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(
      new URL('../../public/tugas/pertemuan-7/', import.meta.url),
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
