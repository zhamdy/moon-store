import { describe, expect, it } from 'vitest';
import { fillTemplate } from '@/lib/utils/fill-template';
import {
  DEFAULT_CATALOG_PARAMS,
  serializeCatalogParams,
  type CatalogParams,
  type CatalogRoute,
} from '../search-params';
import {
  INITIAL_CONTROLS_STATE,
  activeFilterCount,
  applyStaged,
  clearAllFilters,
  controlsReducer,
  focusAfterRemoval,
  formatPriceSummary,
  removeSummaryPart,
  stagedFromParams,
  summaryParts,
  validateStaged,
  type ControlsState,
} from './catalog-controls-state';

const SHOP: CatalogRoute = { kind: 'all' };
const EVENING: CatalogRoute = { kind: 'collection', slug: 'evening' };

function params(patch: Partial<CatalogParams>): CatalogParams {
  return { ...DEFAULT_CATALOG_PARAMS, ...patch };
}

function openWith(committed: CatalogParams): ControlsState {
  return controlsReducer(INITIAL_CONTROLS_STATE, { type: 'open', committed });
}

describe('filter sheet staging', () => {
  it('stages stock and "Show results" commits it with the page reset', () => {
    const current = params({ page: 3 });
    const state = controlsReducer(openWith(current), { type: 'stage', patch: { inStock: true } });
    const next = applyStaged(current, state.staged, SHOP);
    expect(next).toEqual(params({ stock: 'in', page: 1 }));
    // Page 1 is the default, so it leaves the URL: the `page: null` of the commit.
    expect(serializeCatalogParams(next!, SHOP)).toBe('?stock=in');
  });

  it('closing without applying discards staged changes; reopening shows the committed values', () => {
    const committed = params({ min: 500 });
    let state = openWith(committed);
    state = controlsReducer(state, { type: 'stage', patch: { inStock: true, min: '900' } });
    state = controlsReducer(state, { type: 'close' });
    expect(state.open).toBe(false);
    state = controlsReducer(state, { type: 'open', committed });
    expect(state.staged).toEqual({ inStock: false, min: '500', max: '' });
  });

  it('ignores staging while closed', () => {
    const state = controlsReducer(INITIAL_CONTROLS_STATE, {
      type: 'stage',
      patch: { inStock: true },
    });
    expect(state).toBe(INITIAL_CONTROLS_STATE);
  });

  it('marks min > max invalid, so apply is not allowed', () => {
    const staged = { inStock: false, min: '3000', max: '500' };
    expect(validateStaged(staged)).toMatchObject({ orderInvalid: true, valid: false });
    expect(applyStaged(params({}), staged, SHOP)).toBeNull();
  });

  it('compares bounds as typed, before snapping', () => {
    expect(validateStaged({ inStock: false, min: '520', max: '510' }).valid).toBe(false);
  });

  it('marks a non-numeric bound invalid', () => {
    expect(validateStaged({ inStock: false, min: '5a', max: '' })).toMatchObject({
      minInvalid: true,
      valid: false,
    });
  });

  it('marks a bound above the API price ceiling invalid, so apply is not allowed', () => {
    const staged = { inStock: false, min: '10000001', max: '99999999' };
    expect(validateStaged(staged)).toMatchObject({
      minTooHigh: true,
      maxTooHigh: true,
      minInvalid: false,
      valid: false,
    });
    expect(applyStaged(params({}), staged, SHOP)).toBeNull();
    expect(validateStaged({ inStock: false, min: '', max: '10000000' })).toMatchObject({
      max: 10_000_000,
      maxTooHigh: false,
      valid: true,
    });
  });

  it('an emptied price input removes that bound; min alone is valid', () => {
    const current = params({ min: 500, max: 3000 });
    const staged = { ...stagedFromParams(current), max: '  ' };
    expect(validateStaged(staged).valid).toBe(true);
    expect(applyStaged(current, staged, SHOP)).toEqual(params({ min: 500 }));
  });

  it('normalises Eastern Arabic digits and snaps bounds to 50 EGP', () => {
    const next = applyStaged(params({}), { inStock: false, min: '٥٠٠', max: '2980' }, SHOP);
    expect(next).toMatchObject({ min: 500, max: 3000 });
  });

  it('snaps min down and accepts grouping separators', () => {
    const next = applyStaged(params({}), { inStock: false, min: '1,275', max: '' }, SHOP);
    expect(next).toMatchObject({ min: 1250, max: null });
  });

  it('reapplying unchanged values keeps the page', () => {
    const current = params({ stock: 'in', page: 4 });
    expect(applyStaged(current, stagedFromParams(current), SHOP)).toEqual(current);
  });

  it('touch marks a field for error display; open resets it', () => {
    let state = controlsReducer(openWith(params({})), { type: 'touch', field: 'max' });
    expect(state.touched).toEqual({ min: false, max: true });
    state = controlsReducer(state, { type: 'open', committed: params({}) });
    expect(state.touched).toEqual({ min: false, max: false });
  });
});

describe('committing from the summary', () => {
  it('"Clear all" removes every filter and keeps sort', () => {
    const current = params({ stock: 'in', min: 500, max: 3000, sort: 'price-asc', page: 2 });
    expect(clearAllFilters(current, SHOP)).toEqual(params({ sort: 'price-asc' }));
  });

  it('removing one part commits only that removal and resets page', () => {
    const current = params({ stock: 'in', min: 500, max: 3000, page: 5 });
    expect(removeSummaryPart(current, 'stock', SHOP)).toEqual(
      params({ min: 500, max: 3000, page: 1 })
    );
    expect(removeSummaryPart(current, 'price', SHOP)).toEqual(params({ stock: 'in', page: 1 }));
  });

  it('never spells out the route default sort', () => {
    const current = params({ stock: 'in', sort: 'curated' });
    expect(removeSummaryPart(current, 'stock', EVENING).sort).toBeNull();
  });

  it('focus moves to the next remove control, else the Filter button', () => {
    expect(focusAfterRemoval(['stock', 'price'], 'stock')).toBe('price');
    expect(focusAfterRemoval(['stock', 'price'], 'price')).toBe('filter');
    expect(focusAfterRemoval(['price'], 'price')).toBe('filter');
  });
});

describe('derived values', () => {
  it('active count: stock and a price range count as 2; sort does not count', () => {
    expect(
      activeFilterCount(params({ stock: 'in', min: 500, max: 3000, sort: 'price-desc' }))
    ).toBe(2);
    expect(activeFilterCount(params({ max: 3000 }))).toBe(1);
    expect(activeFilterCount(params({ sort: 'price-asc', page: 3 }))).toBe(0);
    expect(summaryParts(params({ stock: 'in', min: 500 }))).toEqual(['stock', 'price']);
  });

  it('fills templates and leaves unknown placeholders', () => {
    expect(fillTemplate('Remove: {filter}', { filter: 'In stock' })).toBe('Remove: In stock');
    expect(fillTemplate('{a} {b}', { a: 1 })).toBe('1 {b}');
  });

  it('formats the price summary for each bound shape', () => {
    const templates = {
      between: '{min}–{max} {currency}',
      from: 'From {min} {currency}',
      upTo: 'Up to {max} {currency}',
    };
    const format = (n: number) => n.toLocaleString('en');
    expect(formatPriceSummary({ min: 500, max: 3000 }, templates, 'EGP', format)).toBe(
      '500–3,000 EGP'
    );
    expect(formatPriceSummary({ min: 500, max: null }, templates, 'EGP', format)).toBe(
      'From 500 EGP'
    );
    expect(formatPriceSummary({ min: null, max: 3000 }, templates, 'EGP', format)).toBe(
      'Up to 3,000 EGP'
    );
    expect(formatPriceSummary({ min: null, max: null }, templates, 'EGP', format)).toBeNull();
  });
});
