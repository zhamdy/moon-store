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

// R9: the nine feature slices under src/features/. Kept in sync manually
// with the folder names (boundaries/element-types below derives the same
// set from the filesystem via the `src/features/*/**` pattern; this list
// only feeds the no-restricted-imports glob, which can't capture a wildcard
// segment the way the boundaries plugin can).
const featureSlices = [
  'admin',
  'analytics',
  'auth',
  'customers',
  'fulfillment',
  'inventory',
  'pos',
  'purchasing',
  'sales',
];
const restrictedFeatureEscapes = featureSlices.flatMap((slice) => [
  `../../${slice}/*`,
  `../../../${slice}/*`,
]);

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
      // `.husky/pre-commit` runs `npx lint-staged` with the repo root as cwd
      // (see the comment on `tsconfigPath` above), and `boundaries/elements`
      // patterns are matched against paths relative to `process.cwd()` by
      // default -- so without this, a file path arrives as
      // "client/src/features/..." from the repo root but "src/features/..."
      // from client/, and every `src/**` pattern below silently stops
      // matching for the root-cwd invocation. Anchor to this config file's
      // own directory so both invocations resolve identically.
      'boundaries/root-path': import.meta.dirname,
      // Architectural layers, matched by path. `feature` captures the
      // slice name (the `*` segment) so same-slice imports can be allowed at
      // any depth while cross-slice imports are restricted to the barrel.
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'routes', pattern: 'src/routes/**' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared/**' },
      ],
      // A file-level category (elements only classify folders) for the
      // slice's public barrel, so "another slice only at its barrel" below
      // can match on `file.categories` instead of the dependency rule's
      // file-internal-path matching, which classifies by the element's own
      // matched folder and doesn't hold up once a file is nested more than
      // one directory below the captured slice segment.
      'boundaries/files': [{ category: 'barrel', pattern: 'src/features/*/index.ts' }],
      // src/vite-env.d.ts is a Vite ambient-types file at the src/ root, and
      // vite.config.ts / vitest.config.ts are root-level Node tooling config
      // -- none of the three belong to app/feature/shared application code.
      'boundaries/ignore': [
        'src/vite-env.d.ts',
        'src/routeTree.gen.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // R17: any src/ file that lands outside app/feature/shared, or any
      // resolved import that doesn't match a known element, is an error
      // rather than silently unconstrained.
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/no-unknown-files': 'error',
      // R7/R8/R16: the dependency direction rules for the architectural layers.
      //   app     -> feature, shared, and routes
      //   routes  -> feature (at barrel), shared, app, and routes
      //   feature -> shared, itself (same slice, any depth), and other
      //              features only at their barrel (@/features/<name>)
      //   shared  -> shared only (this is R16; it also blocks shared -> app)
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: [
                { to: { element: { type: 'feature' } } },
                { to: { element: { type: 'shared' } } },
                { to: { element: { type: 'routes' } } },
              ],
            },
            {
              from: { element: { type: 'routes' } },
              allow: [
                { to: { element: { type: 'feature' }, file: { categories: 'barrel' } } },
                { to: { element: { type: 'shared' } } },
                { to: { element: { type: 'app' } } },
                { to: { element: { type: 'routes' } } },
              ],
            },
            {
              from: { element: { type: 'feature' } },
              allow: [
                { to: { element: { type: 'shared' } } },
                // Same slice, any depth (including its own barrel).
                {
                  to: {
                    element: { type: 'feature', captured: { slice: '{{from.captured.slice}}' } },
                  },
                },
                // Another slice, but only at its barrel.
                { to: { element: { type: 'feature' }, file: { categories: 'barrel' } } },
              ],
            },
            {
              from: { element: { type: 'shared' } },
              allow: [{ to: { element: { type: 'shared' } } }],
            },
          ],
        },
      ],
    },
  },
  {
    // The contract half of the transport seam. Everything above it deals in
    // rows and errors; only the HTTP adapter is allowed to know about axios,
    // the /api/v1 prefix or the response envelope. Without this rule the next
    // page written quietly reintroduces the pattern this seam removed.
    //
    // Also carries R9: belt-and-braces for the `boundaries/element-types`
    // rule above -- a relative specifier cannot escape a slice at depth <=2
    // within the documented shape (pages/, components/, components/<sub>/)
    // without landing on another slice's internals. `boundaries/element-types`
    // already catches this by resolved module regardless of import style;
    // this just gives a faster, clearer message for the common typo. Both
    // restrictions live in this one block because eslint's flat config
    // replaces (not merges) a rule's options across matching configs, and
    // both target overlapping files under src/**.
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
            {
              // The relative-escape half of R9. `no-restricted-imports`
              // matches with the `ignore` package (gitignore semantics, not
              // minimatch): its `*`/`**` don't treat ".." specially, so a
              // generic "../../*/**"-shaped pattern also matches legitimate
              // "../../../shared/..." and "../../../../shared/..." imports
              // (three and four dots resolve through src/ and are common).
              // Enumerating the known slice names sidesteps that ambiguity:
              // "../../<slice>/<anything>" (two dots, one more segment) is a
              // depth-1 file reaching a sibling slice past its barrel;
              // "../../../<slice>/<anything>" (three dots) is the same
              // reach from a depth-2 file (components/<sub>/File.tsx). The
              // bare barrel form ("../../auth", no trailing segment) is
              // intentionally not matched.
              group: restrictedFeatureEscapes,
              message:
                'Cross-slice imports must go through the barrel (e.g. "../../auth" or "@/features/auth"), not a deeper relative path into another slice.',
            },
          ],
        },
      ],
    },
  }
);
