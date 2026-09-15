import type { AppLocale } from '@/i18n/routing';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import type { CatalogRoute } from '../search-params';
import { catalogPath } from './catalog-path';

/**
 * The page an intro introduces: the four listing routes plus the collections index. A
 * category or collection carries its own localized name, because that name is its `h1`.
 */
export type IntroPage =
  | { kind: 'all' }
  | { kind: 'new' }
  | { kind: 'collections' }
  | { kind: 'category'; name: LocalizedText }
  | { kind: 'collection'; name: LocalizedText };

/** Resolved `catalog.intro.*` strings, in the page's locale. */
export interface IntroLabels {
  shop: string;
  collections: string;
  allPieces: string;
  newIn: string;
}

export interface CatalogIntroHeadings {
  h1: LocalizedText;
  /** The smaller line under the `h1`; `href` makes it the page's one way back up. */
  context: { text: LocalizedText; href: string | null } | null;
}

const COLLECTIONS_INDEX_PATH = '/collections';
const SHOP_PATH = catalogPath({ kind: 'all' } satisfies CatalogRoute);

/**
 * Which text is the intro's `h1` and which is the context line (owner decision
 * 2026-09-15, #200). The page's own name is always the `h1`, so no two category or
 * collection pages share one; "Shop" / "Collections" become the linked context line.
 * A context line that would only repeat the `h1` (`/collections`) is omitted.
 */
export function catalogIntroHeadings(
  page: IntroPage,
  labels: IntroLabels,
  locale: AppLocale
): CatalogIntroHeadings {
  const own = (text: string): LocalizedText => ({ text, lang: locale });

  const { h1, context } = ((): CatalogIntroHeadings => {
    switch (page.kind) {
      case 'all':
        return { h1: own(labels.shop), context: { text: own(labels.allPieces), href: null } };
      case 'new':
        return { h1: own(labels.newIn), context: { text: own(labels.shop), href: SHOP_PATH } };
      case 'category':
        return { h1: page.name, context: { text: own(labels.shop), href: SHOP_PATH } };
      case 'collection':
        return {
          h1: page.name,
          context: { text: own(labels.collections), href: COLLECTIONS_INDEX_PATH },
        };
      case 'collections':
        return { h1: own(labels.collections), context: null };
    }
  })();

  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const repeats =
    context !== null &&
    (normalize(context.text.text) === '' || normalize(context.text.text) === normalize(h1.text));
  return { h1, context: repeats ? null : context };
}
