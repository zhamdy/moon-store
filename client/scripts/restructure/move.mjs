#!/usr/bin/env node
// Manifest-driven ts-morph move driver, reused across Units 4-7 of the
// client feature-slice migration (see
// docs/plans/2026-08-20-001-refactor-client-feature-slice-architecture-plan.md).
//
// Usage (run from client/):
//   node scripts/restructure/move.mjs [manifest.json]
//
// For every { from, to } pair in the manifest's "moves" array, this calls
// SourceFile.move() on the ts-morph Project built from tsconfig.json. move()
// rewrites every *referencing* import/export specifier across the whole
// project via the type checker's own module resolution -- not regex/string
// replacement -- so a file that is renamed or relocated keeps every caller
// pointed at it correctly, including cross-file relative specifiers.
//
// A second pass then normalizes specifiers *inside* the moved files: any
// import that is written as a relative path but resolves to another file
// under the same moved-into top-level directory (e.g. src/shared/**) is
// rewritten to the `@/` alias form. This keeps intra-layer imports uniform
// (R9) and immune to the accidents of manifest ordering -- ts-morph moves
// files one at a time, so an intermediate relative specifier can otherwise
// end up import-correct but stylistically inconsistent with its neighbors.

import { Project } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..', '..');

const manifestArg = process.argv[2] ?? 'scripts/restructure/manifest.json';
const manifestPath = path.isAbsolute(manifestArg) ? manifestArg : path.resolve(clientRoot, manifestArg);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const moves = manifest.moves;

if (!Array.isArray(moves) || moves.length === 0) {
  console.error(`No "moves" array found in ${manifestPath}`);
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: path.resolve(clientRoot, 'tsconfig.json'),
});

// Alias config: read the `@/*` -> `./src/*` mapping straight from tsconfig
// so the normalization pass doesn't hardcode it twice. tsconfig.json allows
// `//` and `/* */` comments, which JSON.parse rejects, so strip them first.
// (No string value in this file contains comment-like sequences, so a plain
// regex strip is safe here.)
const tsconfigRaw = fs
  .readFileSync(path.resolve(clientRoot, 'tsconfig.json'), 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
const tsconfig = JSON.parse(tsconfigRaw);
const aliasTarget = tsconfig.compilerOptions.paths['@/*'][0].replace(/\*$/, ''); // "./src/"
const srcRoot = path.resolve(clientRoot, aliasTarget);

// Track the top-level moved-into directories (e.g. "src/shared") so the
// normalization pass only rewrites specifiers inside layers this run
// actually touched.
const movedIntoRoots = new Set();

for (const { from, to } of moves) {
  const fromAbs = path.resolve(clientRoot, from);
  const toAbs = path.resolve(clientRoot, to);

  // addSourceFileAtPathIfExists (rather than getSourceFile) because tsconfig's
  // "include" only covers .ts/.tsx by default -- .json (resolveJsonModule)
  // and .svg assets aren't auto-discovered by the project but ts-morph can
  // still load and move them explicitly.
  const sourceFile = project.addSourceFileAtPathIfExists(fromAbs);
  if (!sourceFile) {
    console.error(`Manifest entry not found on disk (already moved?): ${from}`);
    process.exit(1);
  }

  sourceFile.move(toAbs);

  // Record the first path segment under src/ (e.g. "shared", "features/pos").
  const relFromSrc = path.relative(srcRoot, toAbs);
  const topSegment = relFromSrc.split(path.sep)[0];
  movedIntoRoots.add(topSegment);
}

project.saveSync();

// --- Repair pass --------------------------------------------------------
// ts-morph's move() reliably rewrites specifiers in files that reference a
// moved file via a *relative* path, and it reliably rewrites the moved
// file's own relative imports to keep them valid. Two cases still come out
// broken and need a manual fix-up, both observed in practice running this
// against the Unit 4 manifest:
//   1. Alias-style specifiers (`@/lib/utils`) in a file that itself moved:
//      when file A (aliased-import of B) and B are moved in the same run,
//      ts-morph does not always re-point A's `@/...` specifier at B's new
//      location.
//   2. A relative specifier to a non-.ts/.tsx target (e.g. a `.json` i18n
//      file) whose own move happens *after* the referencing file's move:
//      the specifier gets recomputed relative to the target's old location
//      and is not revisited when the target later moves.
// Both are deterministic from the manifest's own from/to pairs, so repair
// them by literal lookup rather than trusting the type checker's live
// resolution (which is exactly what's missing in these two cases).
function toPosixNoExt(relPath) {
  return relPath.split(path.sep).join('/').replace(/\.(ts|tsx|json|svg)$/, '');
}

const oldToNewCore = new Map();
for (const { from, to } of moves) {
  const fromCore = toPosixNoExt(path.relative(srcRoot, path.resolve(clientRoot, from)));
  const toCore = toPosixNoExt(path.relative(srcRoot, path.resolve(clientRoot, to)));
  // Store the target's real extension (for .json/.svg, which need it in the
  // specifier) rather than trusting whatever extension the broken specifier
  // text happens to carry -- ts-morph strips it when it first rewrites a
  // specifier to a target that hasn't moved yet.
  const toExt = /\.(json|svg)$/.exec(to)?.[0] ?? '';
  oldToNewCore.set(fromCore, { core: toCore, ext: toExt });
}

for (const sourceFile of project.getSourceFiles()) {
  const declarations = [
    ...sourceFile.getImportDeclarations(),
    ...sourceFile.getExportDeclarations().filter((d) => d.getModuleSpecifierValue() !== undefined),
  ];

  for (const decl of declarations) {
    const specifier = decl.getModuleSpecifierValue();
    if (!specifier) continue;

    const isAlias = specifier.startsWith('@/');
    if (!isAlias && !specifier.startsWith('.')) continue; // not a project-relative specifier we can repair

    let core;
    if (isAlias) {
      core = specifier.slice(2).replace(/\.(json|svg)$/, '');
    } else {
      const absTarget = path.resolve(path.dirname(sourceFile.getFilePath()), specifier);
      core = toPosixNoExt(path.relative(srcRoot, absTarget));
    }

    // Deliberately not gated on decl.getModuleSpecifierSourceFile(): ts-morph's
    // resolution cache can read as "resolved" for a specifier that is actually
    // broken on disk, immediately after a batch of .move() calls. The manifest
    // itself is the source of truth for what moved, so look up the specifier's
    // core path there directly rather than trusting live resolution state.
    const target = oldToNewCore.get(core);
    if (!target || target.core === core) continue; // not a path this manifest run touched
    const { core: newCore, ext } = target;

    let newSpecifier;
    if (isAlias) {
      newSpecifier = '@/' + newCore + ext;
    } else {
      let relSpec = path
        .relative(path.dirname(sourceFile.getFilePath()), path.join(srcRoot, newCore))
        .split(path.sep)
        .join('/');
      if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
      newSpecifier = relSpec + ext;
    }

    decl.setModuleSpecifier(newSpecifier);
  }
}

project.saveSync();

// --- Normalization pass -----------------------------------------------
// For every moved-into top-level dir, rewrite relative import/export
// specifiers that resolve to another file under that same dir to `@/...`.
for (const topSegment of movedIntoRoots) {
  const layerRoot = path.join(srcRoot, topSegment);

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!filePath.startsWith(layerRoot + path.sep) && filePath !== layerRoot) continue;

    const declarations = [
      ...sourceFile.getImportDeclarations(),
      ...sourceFile.getExportDeclarations().filter((d) => d.getModuleSpecifierValue() !== undefined),
    ];

    for (const decl of declarations) {
      const specifier = decl.getModuleSpecifierValue();
      if (!specifier || !specifier.startsWith('.')) continue;

      const resolvedSourceFile = decl.getModuleSpecifierSourceFile();
      if (!resolvedSourceFile) continue;

      const resolvedPath = resolvedSourceFile.getFilePath();
      if (!resolvedPath.startsWith(layerRoot + path.sep)) continue; // doesn't stay inside the layer

      const relFromSrc = path.relative(srcRoot, resolvedPath);
      const aliasSpecifier = '@/' + relFromSrc.split(path.sep).join('/').replace(/\.(ts|tsx)$/, '');

      decl.setModuleSpecifier(aliasSpecifier);
    }
  }
}

project.saveSync();

console.log(`Moved ${moves.length} file(s) from ${manifestPath}.`);
console.log(`Normalized relative-import specifiers inside: ${[...movedIntoRoots].join(', ')}`);
