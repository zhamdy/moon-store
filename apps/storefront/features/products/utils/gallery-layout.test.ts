import { describe, expect, it } from 'vitest';
import {
  GALLERY_LEAD_SIZES,
  GALLERY_SINGLE_SIZES,
  GALLERY_SUPPORTING_SIZES,
  galleryLayout,
} from './gallery-layout';

const images = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ url: `https://media.test/${index + 1}.jpg` }));

describe('gallery sizes', () => {
  it('derives the lead from 7 of 12 columns and the rail from slide widths', () => {
    expect(GALLERY_LEAD_SIZES).toBe(
      [
        '(min-width: 1440px) 752px',
        '(min-width: 1024px) calc(58.33vw - 69.33px)',
        '(min-width: 768px) 58vw',
        '86vw',
      ].join(', ')
    );
  });

  it('halves the column, less the gap, for a paired image', () => {
    expect(GALLERY_SUPPORTING_SIZES).toBe(
      [
        '(min-width: 1440px) 372px',
        '(min-width: 1024px) calc(29.17vw - 38.67px)',
        '(min-width: 768px) 58vw',
        '86vw',
      ].join(', ')
    );
  });

  it('fills the content box below 1024 when there is no rail', () => {
    expect(GALLERY_SINGLE_SIZES).toBe(
      [
        '(min-width: 1440px) 752px',
        '(min-width: 1024px) calc(58.33vw - 69.33px)',
        '(min-width: 768px) calc(100vw - 64px)',
        'calc(100vw - 40px)',
      ].join(', ')
    );
  });
});

describe('galleryLayout', () => {
  it('spans the lead and pairs four supporting images, with separate sizes', () => {
    const model = galleryLayout(images(5));
    if (model.kind !== 'rail') throw new Error('expected a rail');
    expect(model.count).toBe(5);
    const [lead, ...rest] = model.slides;
    expect(lead).toEqual({
      url: 'https://media.test/1.jpg',
      position: 1,
      span: 'full',
      sizes: GALLERY_LEAD_SIZES,
      loading: 'eager',
      fetchPriority: 'high',
    });
    expect(rest.map((slide) => slide.span)).toEqual(['half', 'half', 'half', 'half']);
    expect(rest.map((slide) => slide.position)).toEqual([2, 3, 4, 5]);
    expect(new Set(rest.map((slide) => slide.sizes))).toEqual(new Set([GALLERY_SUPPORTING_SIZES]));
    expect(GALLERY_SUPPORTING_SIZES).not.toBe(GALLERY_LEAD_SIZES);
  });

  it('keeps every image after the lead lazy at default priority', () => {
    const model = galleryLayout(images(9));
    if (model.kind !== 'rail') throw new Error('expected a rail');
    for (const slide of model.slides.slice(1)) {
      expect(slide.loading).toBeUndefined();
      expect(slide.fetchPriority).toBeUndefined();
    }
  });

  it('renders one image as the lead only, with no rail chrome', () => {
    const model = galleryLayout(images(1));
    expect(model).toEqual({
      kind: 'single',
      slides: [
        {
          url: 'https://media.test/1.jpg',
          position: 1,
          span: 'full',
          sizes: GALLERY_SINGLE_SIZES,
          loading: 'eager',
          fetchPriority: 'high',
        },
      ],
    });
  });

  it('spans the last of an odd number of supporting images', () => {
    const model = galleryLayout(images(4));
    if (model.kind !== 'rail') throw new Error('expected a rail');
    expect(model.slides.map((slide) => slide.span)).toEqual(['full', 'half', 'half', 'full']);
    expect(model.slides[3].sizes).toBe(GALLERY_LEAD_SIZES);
  });

  it('gives two images a lead and one spanning supporting image', () => {
    const model = galleryLayout(images(2));
    if (model.kind !== 'rail') throw new Error('expected a rail');
    expect(model.slides.map((slide) => slide.span)).toEqual(['full', 'full']);
  });

  it('returns the placeholder model for no images', () => {
    expect(galleryLayout([])).toEqual({ kind: 'empty' });
  });
});
