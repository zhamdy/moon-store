/**
 * The catalog grid's geometry (plan: Grid composition), in one table so the
 * Tailwind classes in `product-grid.tsx`, the skeleton and the image `sizes` are
 * read from the same numbers. Gutters and the container cap mirror
 * `--page-gutter` / `--container-max` in `app/globals.css`; a change there must
 * change this table.
 */
export interface CatalogGridStep {
  /** Viewport width the step starts at, in px. */
  minWidth: number;
  columns: number;
  /** Column gap in px. */
  columnGap: number;
  /** `--page-gutter` at this width, in px. */
  gutter: number;
}

export const CATALOG_CONTAINER_MAX = 1440;

/** Ordered widest first, as `sizes` media conditions are matched. */
export const CATALOG_GRID_STEPS: readonly CatalogGridStep[] = [
  { minWidth: 1440, columns: 4, columnGap: 24, gutter: 64 },
  { minWidth: 1280, columns: 4, columnGap: 24, gutter: 48 },
  { minWidth: 1024, columns: 3, columnGap: 24, gutter: 48 },
  { minWidth: 768, columns: 2, columnGap: 20, gutter: 32 },
  { minWidth: 0, columns: 2, columnGap: 12, gutter: 20 },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One card's rendered width per step: the content box (viewport, or the capped
 * container, minus both gutters) less the gaps, split across the columns. Past the
 * container cap the width is a constant, so that step is an exact px value.
 */
export function catalogGridSizes(steps: readonly CatalogGridStep[] = CATALOG_GRID_STEPS): string {
  return steps
    .map(({ minWidth, columns, columnGap, gutter }) => {
      const fixed = 2 * gutter + (columns - 1) * columnGap;
      const width =
        minWidth >= CATALOG_CONTAINER_MAX
          ? `${round((CATALOG_CONTAINER_MAX - fixed) / columns)}px`
          : `calc(${round(100 / columns)}vw - ${round(fixed / columns)}px)`;
      return minWidth > 0 ? `(min-width: ${minWidth}px) ${width}` : width;
    })
    .join(', ');
}

export const CATALOG_GRID_SIZES = catalogGridSizes();

/** The widest first row. The server cannot know the viewport, so this is the eager count. */
export const CATALOG_EAGER_COUNT = Math.max(...CATALOG_GRID_STEPS.map((step) => step.columns));

/** The narrowest first row: these cards are in the first row at every width. */
const CATALOG_HIGH_PRIORITY_COUNT = Math.min(...CATALOG_GRID_STEPS.map((step) => step.columns));

/** Entrance stagger applies to the first cards only; later ones rise together. */
export const CATALOG_STAGGER_COUNT = 8;

export interface CatalogImageLoading {
  loading?: 'eager';
  fetchPriority?: 'high';
}

/**
 * Only the first row loads eagerly (R20). The first row is 2, 3 or 4 cards wide
 * depending on the viewport, so the widest row (4) is eager: on two-column
 * layouts cards 3 and 4 sit at the fold, where lazy loading would only delay them.
 * High fetch priority goes only to the cards in the first row at every width.
 */
export function catalogImageLoading(index: number): CatalogImageLoading {
  if (index < CATALOG_HIGH_PRIORITY_COUNT) return { loading: 'eager', fetchPriority: 'high' };
  if (index < CATALOG_EAGER_COUNT) return { loading: 'eager' };
  return {};
}

/** `--motion-stagger` step for a card, or `null` past the staggered cards. */
export function catalogStagger(index: number): number | null {
  return index < CATALOG_STAGGER_COUNT ? index : null;
}

/**
 * The grid's classes, shared by the grid and its skeleton so both have the same
 * geometry: 2 / 2 / 3 / 4 columns at 0 / 768 / 1024 / 1280 with the column gaps
 * above and row gaps of 32 / 48 / 56 / 64px.
 */
export const CATALOG_GRID_CLASS =
  'grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-14 xl:grid-cols-4 xl:gap-y-16';

/** The utility row: result count at the start, the controls slot at the end. Height reserved. */
export const CATALOG_TOOLBAR_CLASS =
  'flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border py-3';
