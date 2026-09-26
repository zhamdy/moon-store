import { tabKeyTarget } from './tab-keys';

/**
 * The product gallery's geometry and rules ("In its chapter", owner decision 2026-09-26,
 * replacing the 2026-09-14 thumbnail column): one 4:5 frame the full width of its column,
 * with a row of thumbnails under it. The step table is what the `[data-gallery*]` rules in
 * `app/globals.css` and each image's `sizes` both read. Gutters, the 24px grid gap and the
 * container cap mirror `--page-gutter`, `ProductDetail`'s 12-column grid and
 * `--container-max`; a change there must change this table.
 */
export interface GalleryStep {
  /** Viewport width the step starts at, in px. */
  minWidth: number;
  /** `--page-gutter` at this width, in px. */
  gutter: number;
  /**
   * `split`: six of the page's twelve columns (from 1024). `full`: the Container's content
   * box. `bleed`: the viewport, edge to edge (phones).
   */
  columns: 'split' | 'full' | 'bleed';
  /** A thumbnail button's width, border and padding included, in px; it is 4:5. */
  thumb: number;
}

export const GALLERY_CONTAINER_MAX = 1440;
/** `ProductDetail`'s column gap (`lg:gap-x-6`); the gallery spans six columns, five gaps. */
const PAGE_GRID_GAP = 24;
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
  { minWidth: 768, gutter: 32, columns: 'full', thumb: 72 },
  { minWidth: 0, gutter: 20, columns: 'bleed', thumb: 64 },
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

/**
 * The gallery column: six of twelve columns of the (capped) content box, which is half of
 * it less half a grid gap; all of it; or the whole viewport.
 */
function columnWidth(step: GalleryStep): [vw: number, px: number] {
  if (step.columns === 'bleed') return [100, 0];
  if (step.columns === 'full') return [100, -2 * step.gutter];
  const fixed = -step.gutter - PAGE_GRID_GAP / 2;
  return step.minWidth >= GALLERY_CONTAINER_MAX
    ? [0, GALLERY_CONTAINER_MAX / 2 + fixed]
    : [50, fixed];
}

function stepsToSizes(steps: readonly GalleryStep[], width: (step: GalleryStep) => string) {
  return steps
    .map((step) =>
      step.minWidth > 0 ? `(min-width: ${step.minWidth}px) ${width(step)}` : width(step)
    )
    .join(', ');
}

/** The large image's rendered width, the gallery column, times `scale` for the zoom image. */
export function galleryImageSizes(
  scale = 1,
  steps: readonly GalleryStep[] = GALLERY_STEPS
): string {
  return stepsToSizes(steps, (step) => {
    const [vw, px] = columnWidth(step);
    return length(vw * scale, px * scale);
  });
}

/**
 * Thumbnails that load eagerly (at low priority): the ones the row shows at 320px without
 * scrolling (four 64px buttons and their 6px gaps). The rest of the row loads lazily.
 */
export const GALLERY_EAGER_THUMBS = 4;

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
  /** One image: no thumbnail row, zoom still applies. */
  | { kind: 'single'; images: [GalleryImageModel] }
  | { kind: 'thumbs'; count: number; thumbSizes: string; images: GalleryImageModel[] };

/**
 * The first large image is the page's only eager *high-priority* image (the LCP); the
 * first `GALLERY_EAGER_THUMBS` small thumbnails also load eagerly, at low priority.
 */
export function galleryLayout(images: readonly { url: string }[]): GalleryModel {
  const count = images.length;
  if (count === 0) return { kind: 'empty' };

  const sizes = galleryImageSizes();
  const zoomSizes = galleryImageSizes(GALLERY_ZOOM_SCALE);
  const models = images.map(
    (image, index): GalleryImageModel => ({
      url: image.url,
      position: index + 1,
      sizes,
      zoomSizes,
      ...(index === 0 ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {}),
    })
  );

  if (count === 1) return { kind: 'single', images: [models[0]] };
  return { kind: 'thumbs', count, thumbSizes: galleryThumbSizes(), images: models };
}

/** The gallery tablist is a horizontal row; the rule itself is `tabKeyTarget`. */
export function galleryKeyTarget(
  key: string,
  index: number,
  count: number,
  dir: 'ltr' | 'rtl'
): number | null {
  return tabKeyTarget(key, index, count, dir, 'horizontal');
}
