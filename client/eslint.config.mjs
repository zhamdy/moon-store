import path from 'node:path';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import boundaries from 'eslint-plugin-boundaries';
import eslintConfigPrettier from 'eslint-config-prettier';

// `.husky/pre-commit` runs `npx lint-staged`, which invokes
// `eslint --config client/eslint.config.mjs` with the repo root as cwd, not `client/`.
// Anchor the tsconfig path to this config file's own directory (import.meta.dirname)
// so the TypeScript resolver finds `tsconfig.json` regardless of the invoking cwd.
const tsconfigPath = path.resolve(import.meta.dirname, 'tsconfig.json');

export default tseslint.config(
  {
    // scripts/restructure/ is temporary Node tooling for the feature-slice
    // migration codemods (deleted in Unit 12), not application source -- it
    // runs under Node, not the browser/React lint ruleset below.
    ignores: ['dist/', 'node_modules/', 'tailwind.config.js', 'postcss.config.js', 'scripts/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: tsconfigPath,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The contract half of the transport seam. Everything above it deals in
    // rows and errors; only the HTTP adapter is allowed to know about axios,
    // the /api/v1 prefix or the response envelope. Without this rule the next
    // page written quietly reintroduces the pattern this seam removed.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/lib/transport/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'Reach the server through the transport seam: useTransport(), resource() or useApiQuery(). Only src/lib/transport may import axios.',
            },
          ],
          patterns: [
            {
              group: ['**/services/api', '**/lib/transport/client'],
              message:
                'The axios instance is internal to the transport adapter. Use useTransport(), resource() or useApiQuery() instead.',
            },
          ],
        },
      ],
    },
  }
);
