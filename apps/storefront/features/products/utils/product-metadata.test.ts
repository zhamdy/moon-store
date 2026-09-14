import { describe, expect, it } from 'vitest';
import { buildProductMetadata, type ProductMetadataInput } from './product-metadata';

const product: ProductMetadataInput['product'] = {
  slug: 'silk-midi-dress',
  name: 'فستان حرير متوسط',
  nameEn: 'Silk Midi Dress',
  description: null,
  descriptionEn: null,
  images: [
    { url: 'http://localhost:3001/uploads/a.jpg' },
    { url: 'http://localhost:3001/uploads/b.jpg' },
  ],
};

const fallbackDescription = (name: string) => `Discover ${name} at Moon Fashion.`;

describe('buildProductMetadata', () => {
  it('en: self canonical, en/ar alternates, first image as OG image, indexable', () => {
    const meta = buildProductMetadata({ locale: 'en', product, fallbackDescription });
    expect(meta.title).toBe('Silk Midi Dress');
    expect(meta.description).toBe('Discover Silk Midi Dress at Moon Fashion.');
    expect(meta.alternates?.canonical).toBe('/en/products/silk-midi-dress');
    expect(meta.alternates?.languages).toEqual({
      en: '/en/products/silk-midi-dress',
      ar: '/ar/products/silk-midi-dress',
    });
    expect(meta.openGraph).toEqual({ images: [{ url: 'http://localhost:3001/uploads/a.jpg' }] });
    expect(meta.robots).toBeUndefined();
  });

  it('an English page with an Arabic-only name uses the Arabic name', () => {
    const meta = buildProductMetadata({
      locale: 'en',
      product: { ...product, nameEn: null },
      fallbackDescription,
    });
    expect(meta.title).toBe('فستان حرير متوسط');
    expect(meta.description).toBe('Discover فستان حرير متوسط at Moon Fashion.');
  });

  it('no images: no openGraph key at all', () => {
    const meta = buildProductMetadata({
      locale: 'ar',
      product: { ...product, images: [] },
      fallbackDescription,
    });
    expect(meta).not.toHaveProperty('openGraph');
    expect(meta.alternates?.canonical).toBe('/ar/products/silk-midi-dress');
  });

  it('uses the description only when it is in the page locale', () => {
    const arOnly = { ...product, description: 'وصف عربي', descriptionEn: null };
    expect(
      buildProductMetadata({ locale: 'ar', product: arOnly, fallbackDescription }).description
    ).toBe('وصف عربي');
    expect(
      buildProductMetadata({ locale: 'en', product: arOnly, fallbackDescription }).description
    ).toBe('Discover Silk Midi Dress at Moon Fashion.');
    const both = { ...arOnly, descriptionEn: 'English copy' };
    expect(
      buildProductMetadata({ locale: 'en', product: both, fallbackDescription }).description
    ).toBe('English copy');
  });

  it('encodes the slug in canonical and alternates', () => {
    const meta = buildProductMetadata({
      locale: 'en',
      product: { ...product, slug: 'a b' },
      fallbackDescription,
    });
    expect(meta.alternates?.canonical).toBe('/en/products/a%20b');
  });
});
