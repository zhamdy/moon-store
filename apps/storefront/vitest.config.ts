import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    /**
     * `node` stays the default: almost every suite here is pure and DOM-free, and the
     * storefront's testing convention is deliberately pure-function-first. A component
     * suite opts in per file with `// @vitest-environment jsdom`, so no existing suite
     * silently gains a DOM (MED-7).
     */
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The real package throws outside the react-server condition; see the stub.
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
});
