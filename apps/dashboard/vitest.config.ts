import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/shared/tests/setup.ts'],
    // Page-level tests render a whole page against the in-memory transport and
    // take seconds each. Vitest's 5s default is fine for one file and too tight
    // once several run concurrently, which showed up as flaky timeouts rather
    // than real failures.
    testTimeout: 20000,
    server: {
      deps: {
        // HeroUI must be transformed by vite rather than loaded natively, or the
        // framer-motion mock in src/shared/tests/setup.ts does not reach it: a
        // natively-imported dependency resolves its own imports through node and
        // never sees vitest's module registry. See the comment on that mock.
        inline: [/@heroui\//],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
