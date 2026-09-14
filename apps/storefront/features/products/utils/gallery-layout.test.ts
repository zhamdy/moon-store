import { describe, expect, it } from 'vitest';
import {
  GALLERY_EAGER_THUMBS,
  galleryImageSizes,
  galleryKeyTarget,
  galleryLayout,
  galleryThumbLoading,
  galleryThumbSizes,
} from './gallery-layout';

describe('galleryThumbLoading', () => {
  it('loads only the first three thumbnails eagerly', () => {
    expect(GALLERY_EAGER_THUMBS).toBe(3);
    expect([0, 1, 2, 3, 4, 8].map(galleryThumbLoading)).toEqual([
      'eager',
      'eager',
      'eager',
      'lazy',
      'lazy',
      'lazy',
    ]);
  });
});

const images = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ url: `https://media.test/${index + 1}.jpg` }));

describe('gallery sizes', () => {
  it('takes the thumbnail column and its gap out of the large image', () => {
    expect(galleryImageSizes(true)).toBe(
      [
        '(min-width: 1440px) 536px',
        '(min-width: 1024px) calc(50vw - 168px)',
        '(min-width: 992px) calc(100vw - 152px)',
        '(min-width: 768px) calc(100vw - 168px)',
        'calc(100vw - 128px)',
      ].join(', ')
    );
  });

  it('fills the gallery column when there is no thumbnail column', () => {
    expect(galleryImageSizes(false)).toBe(
      [
        '(min-width: 1440px) 624px',
        '(min-width: 1024px) calc(50vw - 80px)',
        '(min-width: 992px) calc(100vw - 64px)',
        '(min-width: 768px) calc(100vw - 64px)',
        'calc(100vw - 40px)',
      ].join(', ')
    );
  });

  it('doubles every width for the zoom image', () => {
    expect(galleryImageSizes(true, 2)).toBe(
      [
        '(min-width: 1440px) 1072px',
        '(min-width: 1024px) calc(100vw - 336px)',
        '(min-width: 992px) calc(200vw - 304px)',
        '(min-width: 768px) calc(200vw - 336px)',
        'calc(200vw - 256px)',
      ].join(', ')
    );
  });

  it('sizes the photograph inside the 72 / 88 / 72 thumbnail, less border and padding', () => {
    expect(galleryThumbSizes()).toBe('(min-width: 992px) 64px, (min-width: 768px) 80px, 64px');
  });
});

describe('galleryLayout', () => {
  it('returns the placeholder model for no images', () => {
    expect(galleryLayout([])).toEqual({ kind: 'empty' });
  });

  it('renders one image with no thumbnail column, eager and high priority', () => {
    expect(galleryLayout(images(1))).toEqual({
      kind: 'single',
      images: [
        {
          url: 'https://media.test/1.jpg',
          position: 1,
          sizes: galleryImageSizes(false),
          zoomSizes: galleryImageSizes(false, 2),
          loading: 'eager',
          fetchPriority: 'high',
        },
      ],
    });
  });

  it('keeps only the first of many images eager, all sized beside the thumbnails', () => {
    const model = galleryLayout(images(6));
    if (model.kind !== 'thumbs') throw new Error('expected thumbs');
    expect(model.count).toBe(6);
    expect(model.thumbSizes).toBe(galleryThumbSizes());
    expect(model.images.map((image) => image.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(model.images.filter((image) => image.fetchPriority === 'high')).toHaveLength(1);
    expect(model.images[0]).toMatchObject({ loading: 'eager', fetchPriority: 'high' });
    for (const image of model.images.slice(1)) {
      expect(image.loading).toBeUndefined();
      expect(image.fetchPriority).toBeUndefined();
    }
    expect(new Set(model.images.map((image) => image.sizes))).toEqual(
      new Set([galleryImageSizes(true)])
    );
  });
});

describe('galleryKeyTarget', () => {
  it('moves down and up, wrapping at both ends', () => {
    expect(galleryKeyTarget('ArrowDown', 0, 4, 'ltr')).toBe(1);
    expect(galleryKeyTarget('ArrowDown', 3, 4, 'ltr')).toBe(0);
    expect(galleryKeyTarget('ArrowUp', 2, 4, 'ltr')).toBe(1);
    expect(galleryKeyTarget('ArrowUp', 0, 4, 'ltr')).toBe(3);
  });

  it('reads Right as next in LTR and Left as next in RTL', () => {
    expect(galleryKeyTarget('ArrowRight', 1, 4, 'ltr')).toBe(2);
    expect(galleryKeyTarget('ArrowLeft', 1, 4, 'ltr')).toBe(0);
    expect(galleryKeyTarget('ArrowLeft', 1, 4, 'rtl')).toBe(2);
    expect(galleryKeyTarget('ArrowRight', 1, 4, 'rtl')).toBe(0);
  });

  it('jumps with Home and End', () => {
    expect(galleryKeyTarget('Home', 2, 4, 'rtl')).toBe(0);
    expect(galleryKeyTarget('End', 0, 4, 'ltr')).toBe(3);
  });

  it('ignores other keys and an empty list', () => {
    expect(galleryKeyTarget('Enter', 1, 4, 'ltr')).toBeNull();
    expect(galleryKeyTarget('Tab', 1, 4, 'ltr')).toBeNull();
    expect(galleryKeyTarget('ArrowDown', 0, 0, 'ltr')).toBeNull();
  });
});
