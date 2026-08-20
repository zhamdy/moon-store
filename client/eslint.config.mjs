import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'tailwind.config.js', 'postcss.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
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
    ignores: ['src/lib/transport/**'],
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
