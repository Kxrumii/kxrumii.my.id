/**
 * Injects the shared transition bootstrap (single source:
 * @kxrumii/transition-bridge/bootstrap.inline.js) into a Vite app's index.html.
 *
 * The script is placed immediately after <meta charset> so that it still runs
 * before every stylesheet and module script, while the charset declaration
 * stays within the first 1024 bytes of the document.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const TRANSITION_BOOTSTRAP_MARKER = 'data-transition-bootstrap="v4"';

const CHARSET_PATTERN = /<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/i;

export function readTransitionBootstrap() {
  const file = require.resolve('@kxrumii/transition-bridge/bootstrap.inline.js');
  return readFileSync(file, 'utf8').trim();
}

export function transitionBootstrap() {
  const code = readTransitionBootstrap();

  return {
    name: 'kxrumii-transition-bootstrap',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const source = context?.filename ?? 'index.html';
        if (html.includes(TRANSITION_BOOTSTRAP_MARKER)) {
          throw new Error(`[transition-bootstrap] ${source} already contains the bootstrap.`);
        }
        if (!CHARSET_PATTERN.test(html)) {
          throw new Error(`[transition-bootstrap] <meta charset> not found in ${source}.`);
        }
        return html.replace(
          CHARSET_PATTERN,
          (charset) => `${charset}\n    <script ${TRANSITION_BOOTSTRAP_MARKER}>\n${code}\n</script>`,
        );
      },
    },
  };
}
