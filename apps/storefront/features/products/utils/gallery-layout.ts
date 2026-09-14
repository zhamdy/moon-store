import { tabKeyTarget } from './tab-keys';

/**
 * The product gallery's geometry and rules (PD-10, owner decision 2026-09-14: the Bella
 * template's gallery), in one table so the `[data-gallery*]` rules in `app/globals.css`
 * and each image's `sizes` read the same numbers. A thumbnail column beside one large
 * image: at its inline start from 992, at its inline end below. Gutters, the 32px page
 * column gap and the container cap mirror `--page-gutter`, `ProductDetail`'s `lg:gap-x-8`
 * and `--container-max`; a change there must change this table.
 */
export interface GalleryStep {
  /** Viewport width the step starts at, in px. */
  minWidth: number;
  /** `--page-gutter` at this width, in px. */
  gutter: number;
  /** From 1024 the gallery is 7 of the Container's 12 columns; below, the content box. */
  columns: 'split' | 'full';
  /** The square thumbnail button, border and padding included, in px. */
  thumb: number;
}

export const GALLERY_CONTAINER_MAX = 1440;
const PAGE_COLUMNS = 12;
const GALLERY_COLUMNS = 7;
const PAGE_COLUMN_GAP = 32;
/** Between the thumbnail column and the large image, in px. */
export const GALLERY_THUMB_GAP = 16;
/** A thumbnail's 1px border plus 3px padding, on each side, in px. */
export const GALLERY_THUMB_INSET = 4;
/** Zoom in place magnifies the large image this many times. */
export const GALLERY_ZOOM_SCALE = 2;
/** Zoom exists only for a precise hovering pointer, and only where the page splits. */
export const GALLERY_ZOOM_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';

/** Ordered widest first, as `sizes` media conditions are matched. */
export const GALLERY_STEPS: readonly GalleryStep[] = [
  { minWidth: 1440, gutter: 64, columns: 'split', thumb: 72 },
  { minWidth: 1024, gutter: 48, columns: 'split', thumb: 72 },
  { minWidth: 992, gutter: 32, columns: 'full', thumb: 72 },
  { minWidth: 768, gutter: 32, columns: 'full', thumb: 88 },
  { minWidth: 0, gutter: 20, columns: 'full', thumb: 72 },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `vw + px` as a CSS length. */
function length(vw: number, px: number): string {
  if (vw === 0) return `${round(px)}px`;
  if (px === 0) return `${round(vw)}vw`;
  return `calc(${round(vw)}vw ${px < 0 ? '-' : '+'} ${round(Math.abs(px))}px)`;
}

/** The gallery column: 7 of 12 columns of the (capped) content box, or all of it. */
function columnWidth(step: GalleryStep): [vw: number, px: number] {
  if (step.columns === 'full') return [100, -2 * step.gutter];
  const share = GALLERY_COLUMNS / PAGE_COLUMNS;
  const fixed = -2 * step.gutter - (PAGE_COLUMNS - 1) * PAGE_COLUMN_GAP;
  const inner = (GALLERY_COLUMNS - 1) * PAGE_COLUMN_GAP;
  return step.minWidth >= GALLERY_CONTAINER_MAX
    ? [0, (GALLERY_CONTAINER_MAX + fixed) * share + inner]
    : [100 * share, fixed * share + inner];
}

function stepsToSizes(steps: readonly GalleryStep[], width: (step: GalleryStep) => string) {
  return steps
    .map((step) =>
      step.minWidth > 0 ? `(min-width: ${step.minWidth}px) ${width(step)}` : width(step)
    )
    .join(', ');
}

/**
 * The large image's rendered width: the gallery column, less the thumbnail column and
 * its gap when there are thumbnails, times `scale` for the zoom image.
 */
export function galleryImageSizes(
  withThumbs: boolean,
  scale = 1,
  steps: readonly GalleryStep[] = GALLERY_STEPS
): string {
  return stepsToSizes(steps, (step) => {
    const [vw, px] = columnWidth(step);
    const thumbs = withThumbs ? step.thumb + GALLERY_THUMB_GAP : 0;
    return length(vw * scale, (px - thumbs) * scale);
  });
}

/**
 * Thumbnails that load eagerly (at low priority): the ones in view beside the large image
 * on first paint at the smallest frame. The rest of the column loads lazily.
 */
export const GALLERY_EAGER_THUMBS = 3;

export function galleryThumbLoading(index: number): 'eager' | 'lazy' {
  return index < GALLERY_EAGER_THUMBS ? 'eager' : 'lazy';
}

/** The photograph inside a thumbnail button, less its border and padding. */
export function galleryThumbSizes(steps: readonly GalleryStep[] = GALLERY_STEPS): string {
  // Adjacent steps with the same thumbnail collapse, so the string stays short.
  const distinct = steps.filter((step, index) => steps[index + 1]?.thumb !== step.thumb);
  return stepsToSizes(distinct, (step) => `${step.thumb - 2 * GALLERY_THUMB_INSET}px`);
}

export interface GalleryImageModel {
  url: string;
  /** 1-based, for the "image n of count" alt text and thumbnail name. */
  position: number;
  sizes: string;
  zoomSizes: string;
  loading?: 'eager';
  fetchPriority?: 'high';
}

export type GalleryModel =
  | { kind: 'empty' }
  /** One image: no thumbnail column, zoom still applies. */
  | { kind: 'single'; images: [GalleryImageModel] }
  | { kind: 'thumbs'; count: number; thumbSizes: string; images: GalleryImageModel[] };

/**
 * The first large image is the page's only eager *high-priority* image (the LCP); the
 * first `GALLERY_EAGER_THUMBS` small thumbnails also load eagerly, at low priority.
 */
export function galleryLayout(images: readonly { url: string }[]): GalleryModel {
  const count = images.length;
  if (count === 0) return { kind: 'empty' };

  const withThumbs = count > 1;
  const sizes = galleryImageSizes(withThumbs);
  const zoomSizes = galleryImageSizes(withThumbs, GALLERY_ZOOM_SCALE);
  const models = images.map(
    (image, index): GalleryImageModel => ({
      url: image.url,
      position: index + 1,
      sizes,
      zoomSizes,
      ...(index === 0 ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {}),
    })
  );

  if (!withThumbs) return { kind: 'single', images: [models[0]] };
  return { kind: 'thumbs', count, thumbSizes: galleryThumbSizes(), images: models };
}

/** The gallery tablist is vertical; the rule itself is `tabKeyTarget`. */
export function galleryKeyTarget(
  key: string,
  index: number,
  count: number,
  dir: 'ltr' | 'rtl'
): number | null {
  return tabKeyTarget(key, index, count, dir, 'vertical');
}
