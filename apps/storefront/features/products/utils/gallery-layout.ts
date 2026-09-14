/**
 * The product gallery's geometry (PD-10, Page composition), in one table so the rules in
 * `app/globals.css` (`[data-gallery]`) and each image's `sizes` read the same numbers.
 * From 1024 the gallery is 7 of the Container's 12 columns and the images after the lead
 * sit in pairs; below it is a scroll-snap rail. Gutters, the 32px column gap and the
 * container cap mirror `--page-gutter`, `ProductDetail`'s `lg:gap-x-8` and
 * `--container-max`; a change there must change this table.
 */
export type GalleryStep =
  | {
      kind: 'grid';
      /** Viewport width the step starts at, in px. */
      minWidth: number;
      /** `--page-gutter` at this width, in px. */
      gutter: number;
    }
  | {
      kind: 'rail';
      minWidth: number;
      gutter: number;
      /** One rail slide's width in vw; the rest of the viewport is the peek. */
      slideVw: number;
    };

export const GALLERY_CONTAINER_MAX = 1440;
const PAGE_COLUMNS = 12;
const GALLERY_COLUMNS = 7;
const PAGE_COLUMN_GAP = 32;
/** Between paired images and between rail slides, in px. */
export const GALLERY_GAP = 8;

/** Ordered widest first, as `sizes` media conditions are matched. */
export const GALLERY_STEPS: readonly GalleryStep[] = [
  { kind: 'grid', minWidth: 1440, gutter: 64 },
  { kind: 'grid', minWidth: 1024, gutter: 48 },
  { kind: 'rail', minWidth: 768, gutter: 32, slideVw: 58 },
  { kind: 'rail', minWidth: 0, gutter: 20, slideVw: 86 },
];

export type GalleryRole = 'lead' | 'supporting' | 'single';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `vw + px` as a CSS length. */
function length(vw: number, px: number): string {
  if (vw === 0) return `${round(px)}px`;
  if (px === 0) return `${round(vw)}vw`;
  return `calc(${round(vw)}vw ${px < 0 ? '-' : '+'} ${round(Math.abs(px))}px)`;
}

/** 7 of 12 columns of the content box (viewport or capped container, less both gutters). */
function columnWidth(minWidth: number, gutter: number): [vw: number, px: number] {
  const share = GALLERY_COLUMNS / PAGE_COLUMNS;
  const fixed = -2 * gutter - (PAGE_COLUMNS - 1) * PAGE_COLUMN_GAP;
  const inner = (GALLERY_COLUMNS - 1) * PAGE_COLUMN_GAP;
  return minWidth >= GALLERY_CONTAINER_MAX
    ? [0, (GALLERY_CONTAINER_MAX + fixed) * share + inner]
    : [100 * share, fixed * share + inner];
}

function widthFor(role: GalleryRole, step: GalleryStep): string {
  if (step.kind === 'grid') {
    const [vw, px] = columnWidth(step.minWidth, step.gutter);
    return role === 'supporting' ? length(vw / 2, (px - GALLERY_GAP) / 2) : length(vw, px);
  }
  // A lone image has no rail, so it fills the content box.
  return role === 'single' ? length(100, -2 * step.gutter) : length(step.slideVw, 0);
}

export function gallerySizes(
  role: GalleryRole,
  steps: readonly GalleryStep[] = GALLERY_STEPS
): string {
  return steps
    .map((step) => {
      const width = widthFor(role, step);
      return step.minWidth > 0 ? `(min-width: ${step.minWidth}px) ${width}` : width;
    })
    .join(', ');
}

export const GALLERY_LEAD_SIZES = gallerySizes('lead');
export const GALLERY_SUPPORTING_SIZES = gallerySizes('supporting');
export const GALLERY_SINGLE_SIZES = gallerySizes('single');

export interface GallerySlide {
  url: string;
  /** 1-based, for the "image n of count" alt text. */
  position: number;
  /** From 1024: `full` spans both columns, `half` is one of a pair. */
  span: 'full' | 'half';
  sizes: string;
  loading?: 'eager';
  fetchPriority?: 'high';
}

export type GalleryModel =
  | { kind: 'empty' }
  | { kind: 'single'; slides: [GallerySlide] }
  /** Two or more images: the rail below 1024, with its progress and count description. */
  | { kind: 'rail'; count: number; slides: GallerySlide[] };

/**
 * The lead spans the column and is the page's only eager, high-priority image (the LCP).
 * The rest pair up; when their count is odd the last one spans both columns.
 */
export function galleryLayout(images: readonly { url: string }[]): GalleryModel {
  const count = images.length;
  if (count === 0) return { kind: 'empty' };

  const lead: GallerySlide = {
    url: images[0].url,
    position: 1,
    span: 'full',
    sizes: count === 1 ? GALLERY_SINGLE_SIZES : GALLERY_LEAD_SIZES,
    loading: 'eager',
    fetchPriority: 'high',
  };
  if (count === 1) return { kind: 'single', slides: [lead] };

  const supporting = count - 1;
  const slides = images.slice(1).map((image, index): GallerySlide => {
    const spans = supporting % 2 === 1 && index === supporting - 1;
    return {
      url: image.url,
      position: index + 2,
      span: spans ? 'full' : 'half',
      sizes: spans ? GALLERY_LEAD_SIZES : GALLERY_SUPPORTING_SIZES,
    };
  });
  return { kind: 'rail', count, slides: [lead, ...slides] };
}
