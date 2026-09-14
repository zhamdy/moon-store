/**
 * The slices of a `catalog`-namespace translator these helpers use. Structural so
 * both `getTranslations('catalog')` (components) and `createTranslator` (tests)
 * fit; one signature per type, since next-intl's generic translator does not
 * unify with an overload set.
 */
type ResultCountTranslator = (key: 'resultCount', values: { count: number }) => string;
type ResultsHeadingTranslator = ((
  key: 'resultsHeading',
  values: { page: number; total: number }
) => string) &
  ((key: 'resultsHeadingFirst') => string);

function wholeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/** "24 pieces" through the ICU plural (Arabic uses all six CLDR forms). */
export function formatResultCount(t: ResultCountTranslator, totalItems: number): string {
  return t('resultCount', { count: wholeCount(totalItems) });
}

/**
 * The grid's visually hidden heading: "Products" on page 1, "Products, page 3 of
 * 12" past it, so a fragment jump from pagination announces where it landed.
 */
export function formatResultsHeading(
  t: ResultsHeadingTranslator,
  page: number,
  totalPages: number
): string {
  return page > 1 && totalPages > 1
    ? t('resultsHeading', { page, total: totalPages })
    : t('resultsHeadingFirst');
}
