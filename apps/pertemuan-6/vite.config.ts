import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { transitionBootstrap } from '../../scripts/vite-transition-bootstrap.mjs';

const sharedBootstrap = transitionBootstrap();

// Halaman dokumentasi memakai navigasi native dan tidak boleh memuat bootstrap bridge
// (verifikasi CI hanya mengizinkan bootstrap pada dokumen aplikasi). Plugin bersama tidak diubah.
const appOnlyBootstrap = {
  ...sharedBootstrap,
  name: 'kxrumii-transition-bootstrap-app-only',
  transformIndexHtml: {
    order: 'post',
    handler(html: string, context?: { filename?: string }) {
      const file = (context?.filename ?? '').replaceAll('\\', '/');
      if (file.includes('/dokumentasi/')) return html;
      return sharedBootstrap.transformIndexHtml.handler(html, context);
    },
  },
};

export default defineConfig({
  base: '/tugas/pertemuan-6/',
  plugins: [appOnlyBootstrap],
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
