import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// lint-staged runs `eslint --config apps/storefront/eslint.config.mjs` with the repo
// root as cwd, not `apps/storefront/`. Anchor to this file's own directory
// (import.meta.dirname) so the TypeScript resolver finds tsconfig.json regardless
// of the invoking cwd, mirroring apps/dashboard/eslint.config.mjs.
const tsconfigPath = path.resolve(import.meta.dirname, 'tsconfig.json');

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
    languageOptions: {
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Root-level Node tooling config, not covered by tsconfig.json's include list.
    'eslint.config.mjs',
    'postcss.config.mjs',
  ]),
]);
