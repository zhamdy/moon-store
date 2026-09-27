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
  it('loads only the first four thumbnails eagerly', () => {
    expect(GALLERY_EAGER_THUMBS).toBe(4);
    expect([0, 1, 2, 3, 4, 8].map(galleryThumbLoading)).toEqual([
      'eager',
      'eager',
      'eager',
      'eager',
      'lazy',
      'lazy',
    ]);
  });
});

const images = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ url: `https://media.test/${index + 1}.jpg` }));

describe('gallery sizes', () => {
  it('fills six of twelve columns from 1024, the content box at 768, the viewport below', () => {
    expect(galleryImageSizes()).toBe(
      [
        '(min-width: 1440px) 644px',
        '(min-width: 1024px) calc(50vw - 60px)',
        '(min-width: 768px) calc(100vw - 64px)',
        '100vw',
      ].join(', ')
    );
  });

  it('doubles every width for the zoom image', () => {
    expect(galleryImageSizes(2)).toBe(
      [
        '(min-width: 1440px) 1288px',
        '(min-width: 1024px) calc(100vw - 120px)',
        '(min-width: 768px) calc(200vw - 128px)',
        '200vw',
      ].join(', ')
    );
  });

  it('sizes the photograph inside the 72 / 64 thumbnail, less border and padding', () => {
    expect(galleryThumbSizes()).toBe('(min-width: 768px) 64px, 56px');
  });
});

describe('galleryLayout', () => {
  it('returns the placeholder model for no images', () => {
    expect(galleryLayout([])).toEqual({ kind: 'empty' });
  });

  it('renders one image with no thumbnail row, eager and high priority', () => {
    expect(galleryLayout(images(1))).toEqual({
      kind: 'single',
      images: [
        {
          url: 'https://media.test/1.jpg',
          position: 1,
          sizes: galleryImageSizes(),
          zoomSizes: galleryImageSizes(2),
          loading: 'eager',
          fetchPriority: 'high',
        },
      ],
    });
  });

  it('keeps only the first of many images eager, all sized to the column', () => {
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
      new Set([galleryImageSizes()])
    );
  });
});

describe('galleryKeyTarget', () => {
  it('reads Right as next in LTR and Left as next in RTL, wrapping at both ends', () => {
    expect(galleryKeyTarget('ArrowRight', 1, 4, 'ltr')).toBe(2);
    expect(galleryKeyTarget('ArrowLeft', 1, 4, 'ltr')).toBe(0);
    expect(galleryKeyTarget('ArrowLeft', 1, 4, 'rtl')).toBe(2);
    expect(galleryKeyTarget('ArrowRight', 1, 4, 'rtl')).toBe(0);
    expect(galleryKeyTarget('ArrowRight', 3, 4, 'ltr')).toBe(0);
    expect(galleryKeyTarget('ArrowLeft', 0, 4, 'ltr')).toBe(3);
  });

  it('leaves Up and Down to the page, since the row is horizontal', () => {
    expect(galleryKeyTarget('ArrowDown', 0, 4, 'ltr')).toBeNull();
    expect(galleryKeyTarget('ArrowUp', 2, 4, 'rtl')).toBeNull();
  });

  it('jumps with Home and End', () => {
    expect(galleryKeyTarget('Home', 2, 4, 'rtl')).toBe(0);
    expect(galleryKeyTarget('End', 0, 4, 'ltr')).toBe(3);
  });

  it('ignores other keys and an empty list', () => {
    expect(galleryKeyTarget('Enter', 1, 4, 'ltr')).toBeNull();
    expect(galleryKeyTarget('Tab', 1, 4, 'ltr')).toBeNull();
    expect(galleryKeyTarget('ArrowRight', 0, 0, 'ltr')).toBeNull();
  });
});
