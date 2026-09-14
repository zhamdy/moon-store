import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEditorialAssets, isAssetGuardClean } from './asset-guard';
import { catalogSlots, editorialSlots } from './slots';

describe('checkEditorialAssets (fixtures)', () => {
  it('passes when every file matches a slot and every slot has a file', () => {
    const result = checkEditorialAssets(
      ['hero-desktop.jpg', 'hero-mobile.jpg'],
      ['hero-desktop', 'hero-mobile']
    );
    expect(isAssetGuardClean(result)).toBe(true);
  });

  it('fails on a file with no matching slot, naming the file', () => {
    const result = checkEditorialAssets(
      ['hero-desktop.jpg', 'hero-linen-desktop-v2.jpg'],
      ['hero-desktop']
    );
    expect(result.orphans).toEqual(['hero-linen-desktop-v2.jpg']);
  });

  it('fails on a slot with no matching file, naming the slot', () => {
    const result = checkEditorialAssets(['hero-desktop.jpg'], ['hero-desktop', 'hero-mobile']);
    expect(result.missing).toEqual(['hero-mobile.jpg']);
  });

  it('fails on a non-.jpg image instead of silently ignoring it', () => {
    const result = checkEditorialAssets(['hero-desktop.jpg', 'hero-desktop.png'], ['hero-desktop']);
    expect(result.unexpectedExtensions).toEqual(['hero-desktop.png']);
  });

  it('ignores known OS metadata files', () => {
    const result = checkEditorialAssets(
      ['hero-desktop.jpg', 'Thumbs.db', 'desktop.ini', '.DS_Store'],
      ['hero-desktop']
    );
    expect(isAssetGuardClean(result)).toBe(true);
  });
});

describe('assets/editorial/ (real directory)', () => {
  it('contains exactly the files named by editorialSlots + catalogSlots', () => {
    const dir = join(__dirname, '..', '..', 'assets', 'editorial');
    const files = readdirSync(dir);
    const slots: string[] = [...editorialSlots, ...catalogSlots];

    const result = checkEditorialAssets(files, slots);

    expect(result.orphans, 'orphan files with no slot').toEqual([]);
    expect(result.missing, 'slots with no file').toEqual([]);
    expect(result.unexpectedExtensions, 'non-.jpg files').toEqual([]);
  });
});
