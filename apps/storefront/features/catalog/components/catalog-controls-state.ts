import {
  catalogParsers,
  nextCatalogParams,
  normalizeCatalogParams,
  normalizeDigits,
  type CatalogParams,
  type CatalogRoute,
} from '../search-params';

/**
 * Pure rules for the catalog controls island (`catalog-controls.tsx`), kept out of
 * the component so they are testable without a DOM. Every commit goes through
 * `commitPatch` = `normalizeCatalogParams(nextCatalogParams(current, patch), route)`,
 * so a filter change resets the page and the route default sort never reaches the URL.
 */

/** What the filter sheet edits. Price inputs stay raw strings until applied. */
export interface StagedFilters {
  inStock: boolean;
  min: string;
  max: string;
}

export interface ControlsState {
  open: boolean;
  staged: StagedFilters;
  /** A price field's error shows only once the field has been left (or on apply). */
  touched: { min: boolean; max: boolean };
}

export type ControlsAction =
  | { type: 'open'; committed: CatalogParams }
  | { type: 'stage'; patch: Partial<StagedFilters> }
  | { type: 'touch'; field: 'min' | 'max' }
  /** Escape, the close button, the backdrop, or after a commit: staged edits are dropped. */
  | { type: 'close' };

export const EMPTY_STAGED: StagedFilters = { inStock: false, min: '', max: '' };

export const INITIAL_CONTROLS_STATE: ControlsState = {
  open: false,
  staged: EMPTY_STAGED,
  touched: { min: false, max: false },
};

export function stagedFromParams(params: CatalogParams): StagedFilters {
  return {
    inStock: params.stock === 'in',
    min: params.min === null ? '' : String(params.min),
    max: params.max === null ? '' : String(params.max),
  };
}

export function controlsReducer(state: ControlsState, action: ControlsAction): ControlsState {
  switch (action.type) {
    case 'open':
      // Re-seeded from the committed URL on every open, so a discarded edit never survives.
      return {
        open: true,
        staged: stagedFromParams(action.committed),
        touched: { min: false, max: false },
      };
    case 'stage':
      return state.open ? { ...state, staged: { ...state.staged, ...action.patch } } : state;
    case 'touch':
      return { ...state, touched: { ...state.touched, [action.field]: true } };
    case 'close':
      return INITIAL_CONTROLS_STATE;
  }
}

export interface StagedValidation {
  /** Snapped bounds as they would commit; `null` for an empty or invalid field. */
  min: number | null;
  max: number | null;
  /** Not a whole number once digits are normalised. */
  minInvalid: boolean;
  maxInvalid: boolean;
  /** Both bounds given and the typed minimum exceeds the typed maximum. */
  orderInvalid: boolean;
  valid: boolean;
}

function readBound(raw: string, key: 'min' | 'max') {
  const trimmed = raw.trim();
  if (trimmed === '') return { typed: null, snapped: null, invalid: false };
  const digits = normalizeDigits(trimmed);
  if (digits === null) return { typed: null, snapped: null, invalid: true };
  // The URL parsers own digit normalisation and the 50 EGP snap (KD-11): min down, max up.
  return { typed: Number(digits), snapped: catalogParsers[key].parse(digits), invalid: false };
}

export function validateStaged(staged: StagedFilters): StagedValidation {
  const min = readBound(staged.min, 'min');
  const max = readBound(staged.max, 'max');
  // Compared as typed, not as snapped: 520–510 is the shopper's mistake even though
  // snapping would turn it into a valid 500–550.
  const orderInvalid = min.typed !== null && max.typed !== null && min.typed > max.typed;
  return {
    min: min.snapped,
    max: max.snapped,
    minInvalid: min.invalid,
    maxInvalid: max.invalid,
    orderInvalid,
    valid: !min.invalid && !max.invalid && !orderInvalid,
  };
}

export function commitPatch(
  current: CatalogParams,
  patch: Partial<CatalogParams>,
  route: CatalogRoute
): CatalogParams {
  return normalizeCatalogParams(nextCatalogParams(current, patch), route);
}

/** "Show results": the next committed params, or `null` when the staged values are invalid. */
export function applyStaged(
  current: CatalogParams,
  staged: StagedFilters,
  route: CatalogRoute
): CatalogParams | null {
  const validation = validateStaged(staged);
  if (!validation.valid) return null;
  return commitPatch(
    current,
    { stock: staged.inStock ? 'in' : null, min: validation.min, max: validation.max },
    route
  );
}

/** "Clear all" / "Clear": every filter removed, sort kept (it is not a filter). */
export function clearAllFilters(current: CatalogParams, route: CatalogRoute): CatalogParams {
  return commitPatch(current, { stock: null, min: null, max: null }, route);
}

/** One part of the active filter summary. Price is one part, however many bounds it has. */
export type SummaryPart = 'stock' | 'price';

export function summaryParts(params: CatalogParams): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (params.stock !== null) parts.push('stock');
  if (params.min !== null || params.max !== null) parts.push('price');
  return parts;
}

/** The Filter button's count: availability and the price range count one each; sort never. */
export function activeFilterCount(params: CatalogParams): number {
  return summaryParts(params).length;
}

export function removeSummaryPart(
  current: CatalogParams,
  part: SummaryPart,
  route: CatalogRoute
): CatalogParams {
  return commitPatch(current, part === 'stock' ? { stock: null } : { min: null, max: null }, route);
}

/** Where focus goes after a removal: the next remove control, else the Filter button. */
export function focusAfterRemoval(
  parts: SummaryPart[],
  removed: SummaryPart
): SummaryPart | 'filter' {
  const index = parts.indexOf(removed);
  const remaining = parts.filter((part) => part !== removed);
  return remaining[index] ?? 'filter';
}

/**
 * `{name}` substitution for the few templates the island formats with client-side
 * values (the island never receives the message catalogue or an ICU formatter).
 * An unknown placeholder is left as written.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

export interface PriceSummaryTemplates {
  /** "{min}–{max} {currency}" */
  between: string;
  /** "From {min} {currency}" */
  from: string;
  /** "Up to {max} {currency}" */
  upTo: string;
}

/** "500–3,000 EGP", "From 500 EGP", "Up to 3,000 EGP", or `null` with no bound. */
export function formatPriceSummary(
  params: Pick<CatalogParams, 'min' | 'max'>,
  templates: PriceSummaryTemplates,
  currency: string,
  formatAmount: (amount: number) => string
): string | null {
  const { min, max } = params;
  if (min !== null && max !== null) {
    return fillTemplate(templates.between, {
      min: formatAmount(min),
      max: formatAmount(max),
      currency,
    });
  }
  if (min !== null) return fillTemplate(templates.from, { min: formatAmount(min), currency });
  if (max !== null) return fillTemplate(templates.upTo, { max: formatAmount(max), currency });
  return null;
}
