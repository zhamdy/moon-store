import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import {
  englishForWrite,
  slugFailureMessage,
  slugForWrite,
  slugify,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from './slug';
import type { MutationFailure } from '../../../shared/lib/mutationError';

const failure = (details: MutationFailure['details']): MutationFailure => ({
  kind: 'conflict',
  recovery: 'review',
  message: 'Conflict',
  fieldErrors: {},
  details,
  status: 409,
  retryable: false,
});

describe('slugify', () => {
  it('produces a slug the server pattern accepts', () => {
    expect(slugify('  Silk Evening Dress!  ')).toBe('silk-evening-dress');
    expect(slugify('Creme Brulee -- Edition 2')).toBe('creme-brulee-edition-2');
    expect(SLUG_PATTERN.test(slugify('A  --  B'))).toBe(true);
  });

  it('strips diacritics and never transliterates Arabic', () => {
    expect(slugify('Cr\u00e8me')).toBe('creme');
    expect(slugify('\u0641\u0633\u062a\u0627\u0646')).toBe('');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('write helpers', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('omits a blank slug and nulls blank English copy', () => {
    expect(slugForWrite('  ')).toBeUndefined();
    expect(slugForWrite(' dress ')).toBe('dress');
    expect(englishForWrite('')).toBeNull();
    expect(englishForWrite(' Dress ')).toBe('Dress');
  });

  it('maps only slug details to an inline message', () => {
    expect(
      slugFailureMessage(failure([{ field: 'slug', code: 'SLUG_TAKEN', message: 'taken' }]))
    ).toBe('This slug is already in use. Choose another.');
    expect(
      slugFailureMessage(failure([{ field: 'expected_updated_at', code: 'STALE', message: 'x' }]))
    ).toBeNull();
  });
});
