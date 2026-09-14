/**
 * Pure comparison of the files actually in `assets/editorial/` against the slot
 * lists in `slots.ts`, so the error paths (orphan file, missing slot, wrong
 * extension) run against fixtures rather than only the real directory. The real
 * directory listing lives in `assets.test.ts`, never here — this module never
 * touches the filesystem.
 */

/** OS metadata `.gitignore` already keeps out of the repo; harmless if seen locally. */
const IGNORED_FILENAMES = new Set(['Thumbs.db', 'desktop.ini', '.DS_Store']);

export interface AssetGuardResult {
  orphans: string[];
  missing: string[];
  unexpectedExtensions: string[];
}

/**
 * `files` is the plain list of entries found in `assets/editorial/` (filenames,
 * not paths). `slots` is every registered slot name (editorial + catalog),
 * without extension.
 */
export function checkEditorialAssets(files: string[], slots: readonly string[]): AssetGuardResult {
  const slotSet = new Set(slots);
  const seen = new Set<string>();
  const orphans: string[] = [];
  const unexpectedExtensions: string[] = [];

  for (const file of files) {
    if (IGNORED_FILENAMES.has(file)) continue;

    if (!file.endsWith('.jpg')) {
      unexpectedExtensions.push(file);
      continue;
    }

    const slot = file.slice(0, -'.jpg'.length);
    seen.add(slot);
    if (!slotSet.has(slot)) {
      orphans.push(file);
    }
  }

  const missing = slots.filter((slot) => !seen.has(slot)).map((slot) => `${slot}.jpg`);

  return { orphans, missing, unexpectedExtensions };
}

export function isAssetGuardClean(result: AssetGuardResult): boolean {
  return (
    result.orphans.length === 0 &&
    result.missing.length === 0 &&
    result.unexpectedExtensions.length === 0
  );
}
