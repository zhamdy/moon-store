import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
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
