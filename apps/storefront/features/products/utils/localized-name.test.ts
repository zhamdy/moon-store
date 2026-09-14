import { describe, expect, it } from 'vitest';
import { localizedName } from './localized-name';

describe('localizedName', () => {
  it('uses the English name in en', () => {
    expect(localizedName({ name: 'فستان', nameEn: 'Dress' }, 'en')).toEqual({
      text: 'Dress',
      lang: 'en',
    });
  });

  it('uses the Arabic name in ar, even when an English one exists', () => {
    expect(localizedName({ name: 'فستان', nameEn: 'Dress' }, 'ar')).toEqual({
      text: 'فستان',
      lang: 'ar',
    });
  });

  it('falls back to the Arabic name, marked ar, when nameEn is null', () => {
    expect(localizedName({ name: 'فستان', nameEn: null }, 'en')).toEqual({
      text: 'فستان',
      lang: 'ar',
    });
  });

  it('treats an empty or whitespace-only nameEn as missing', () => {
    expect(localizedName({ name: 'فستان', nameEn: '   ' }, 'en')).toEqual({
      text: 'فستان',
      lang: 'ar',
    });
    expect(localizedName({ name: 'فستان', nameEn: '' }, 'en')).toEqual({
      text: 'فستان',
      lang: 'ar',
    });
  });
});
