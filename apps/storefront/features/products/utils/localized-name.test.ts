import { describe, expect, it } from 'vitest';
import { localizedDescription, localizedName } from './localized-name';

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

describe('localizedDescription', () => {
  const both = { description: 'وصف', descriptionEn: 'A description' };

  it('uses the English description in en and the Arabic one in ar', () => {
    expect(localizedDescription(both, 'en')).toEqual({ text: 'A description', lang: 'en' });
    expect(localizedDescription(both, 'ar')).toEqual({ text: 'وصف', lang: 'ar' });
  });

  it('falls back to Arabic in en when English is missing or blank', () => {
    expect(localizedDescription({ description: 'وصف', descriptionEn: '  ' }, 'en')).toEqual({
      text: 'وصف',
      lang: 'ar',
    });
  });

  it('never shows English copy on an Arabic page', () => {
    expect(
      localizedDescription({ description: null, descriptionEn: 'Only English' }, 'ar')
    ).toBeNull();
  });

  it('is null when neither exists', () => {
    expect(localizedDescription({ description: ' ', descriptionEn: null }, 'en')).toBeNull();
  });
});
