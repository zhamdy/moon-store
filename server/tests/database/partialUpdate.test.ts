/**
 * The absent/null distinction, asserted on its own.
 *
 * Every repository that merges a partial update depends on exactly one rule: `undefined`
 * is "the body did not mention this column", `null` is "the body asked to clear it". Get
 * that backwards and the endpoint is back to #78 — a 200 and a field nobody mentioned
 * quietly reset. Testing it here means each adopting repository only has to prove it wired
 * its own columns up, not re-prove the rule.
 */
import { describe, expect, it } from 'vitest';
import { buildPartialUpdate, orNull } from '../../src/database/partialUpdate';

describe('buildPartialUpdate', () => {
  it('writes only the columns whose values are defined', () => {
    const { setClause, params, nextIndex } = buildPartialUpdate({
      name: 'Autumn window',
      description: undefined,
      is_featured: 1,
    });

    expect(setClause).toBe('name = $1, is_featured = $2, updated_at = NOW()');
    expect(params).toEqual(['Autumn window', 1]);
    expect(nextIndex).toBe(3);
  });

  it('writes an explicit null, because clearing a column is a real instruction', () => {
    const { setClause, params } = buildPartialUpdate({ description: null, season: undefined });

    expect(setClause).toBe('description = $1, updated_at = NOW()');
    expect(params).toEqual([null]);
  });

  it('writes falsy values that are not undefined', () => {
    // The bug this guards: a truthiness test would drop all three of these, and `0` on a
    // boolean-ish column is exactly the value a caller most needs to be able to set.
    const { setClause, params } = buildPartialUpdate({ is_featured: 0, rate: 0, note: '' });

    expect(setClause).toBe('is_featured = $1, rate = $2, note = $3, updated_at = NOW()');
    expect(params).toEqual([0, 0, '']);
  });

  it('still produces valid SQL when the body named no columns at all', () => {
    // A collection edit that only replaced the product set reaches here with nothing to
    // assign. It must still be a legal UPDATE that touches the row, not `SET  WHERE`.
    const { setClause, params, nextIndex } = buildPartialUpdate({ name: undefined });

    expect(setClause).toBe('updated_at = NOW()');
    expect(params).toEqual([]);
    expect(nextIndex).toBe(1);
  });

  it('numbers parameters from a caller-supplied offset', () => {
    const { setClause, nextIndex } = buildPartialUpdate({ a: 1, b: 2 }, { startIndex: 4 });

    expect(setClause).toBe('a = $4, b = $5, updated_at = NOW()');
    expect(nextIndex).toBe(6);
  });

  it('takes the always-set fragments the caller names, or none', () => {
    expect(buildPartialUpdate({ a: 1 }, { alwaysSet: [] }).setClause).toBe('a = $1');
    expect(buildPartialUpdate({ a: 1 }, { alwaysSet: ['touched_at = NOW()'] }).setClause).toBe(
      'a = $1, touched_at = NOW()'
    );
  });
});

describe('orNull', () => {
  it('keeps undefined undefined, so an absent field stays absent', () => {
    expect(orNull(undefined)).toBeUndefined();
  });

  it('maps a cleared form field to NULL, as these columns have always done', () => {
    expect(orNull('')).toBeNull();
    expect(orNull(null)).toBeNull();
  });

  it('passes a real value through', () => {
    expect(orNull('Fall')).toBe('Fall');
  });
});
