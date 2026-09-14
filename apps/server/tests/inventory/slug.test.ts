/**
 * The pure half of slug handling (plan 2026-09-14-002, KD-6): the pattern, slugify and the
 * candidate list. Generation against a database is covered at the HTTP boundary in
 * `tests/products.test.ts` and under real concurrency in
 * `tests/concurrency/catalogSlug.concurrency.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  SLUG_BASE_MAX_LENGTH,
  SLUG_CONSTRAINTS,
  isSlugViolation,
  slugBase,
  slugCandidates,
  slugSchema,
  slugify,
} from '../../src/modules/inventory/shared/slug';

describe('slugify', () => {
  it.each([
    ['Silk Slip Dress', 'silk-slip-dress'],
    ['  --Wool__Coat--  ', 'wool-coat'],
    ['MN-DR-001', 'mn-dr-001'],
    ['ABC_1', 'abc-1'],
    ["Women's A/W 2026", 'women-s-a-w-2026'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ['Arabic only', '\u0641\u0633\u062a\u0627\u0646 \u0633\u0647\u0631\u0629'],
    ['punctuation only', '!!! ??? ---'],
    ['empty', ''],
    ['null', null],
  ])('returns null for %s, so the next source is used', (_label, input) => {
    expect(slugify(input)).toBeNull();
  });

  it('keeps only the ASCII of a mixed name', () => {
    expect(slugify('Abaya \u0639\u0628\u0627\u064a\u0629 Noir')).toBe('abaya-noir');
  });

  it('cuts to the base limit without leaving a trailing hyphen', () => {
    const cut = slugify(`${'a'.repeat(SLUG_BASE_MAX_LENGTH - 1)} bcd`);
    expect(cut).toBe('a'.repeat(SLUG_BASE_MAX_LENGTH - 1));
    expect(slugify('x'.repeat(200))!.length).toBe(SLUG_BASE_MAX_LENGTH);
  });
});

describe('slugCandidates and slugBase', () => {
  it('lists base, base-2 ... base-10, all within the 80-character pattern', () => {
    const base = 'b'.repeat(SLUG_BASE_MAX_LENGTH);
    const candidates = slugCandidates(base);
    expect(candidates).toHaveLength(10);
    expect(candidates[0]).toBe(base);
    expect(candidates[1]).toBe(`${base}-2`);
    expect(candidates[9]).toBe(`${base}-10`);
    for (const c of candidates) expect(slugSchema.safeParse(c).success).toBe(true);
  });

  it('takes the first source that slugifies, else the resource-id fallback', () => {
    expect(slugBase('products', 7, ['Silk Slip Dress', 'SKU-1'])).toBe('silk-slip-dress');
    expect(slugBase('products', 7, ['\u0641\u0633\u062a\u0627\u0646', 'SKU-1'])).toBe('sku-1');
    expect(slugBase('products', 7, [undefined, '\u0661\u0662'])).toBe('product-7');
    expect(slugBase('categories', 3, [null])).toBe('category-3');
    expect(slugBase('collections', 12, [])).toBe('collection-12');
  });
});

describe('slugSchema', () => {
  it.each(['silk-dress', 'a', 'abc-1-2', '2026'])('accepts %s', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    'Silk Dress',
    'silk dress',
    'silk--dress',
    '-silk',
    'silk-',
    'silk_dress',
    '',
    'a'.repeat(81),
    '\u0641\u0633\u062a\u0627\u0646',
  ])('rejects %j', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});

describe('isSlugViolation', () => {
  const violation = (constraint?: string) =>
    Object.assign(new Error('duplicate key'), { code: '23505', constraint });

  it('matches only a unique violation on that table slug index', () => {
    expect(isSlugViolation(violation(SLUG_CONSTRAINTS.products), 'products')).toBe(true);
    expect(isSlugViolation(violation(SLUG_CONSTRAINTS.products), 'collections')).toBe(false);
    expect(isSlugViolation(violation('products_sku_key'), 'products')).toBe(false);
    // pg-mem's shape: a code with no constraint name is never read as a slug collision.
    expect(isSlugViolation(violation(undefined), 'products')).toBe(false);
    expect(
      isSlugViolation(
        Object.assign(new Error('x'), { code: '23503', constraint: SLUG_CONSTRAINTS.products }),
        'products'
      )
    ).toBe(false);
  });
});
