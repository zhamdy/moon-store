import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogCategory } from '@/features/collections/types/catalog-category';
import { localizedName } from '@/features/products/utils/localized-name';
import { catalogPath } from '../utils/catalog-path';
import { orderCategories } from '../utils/category-order';
import { formatResultCount } from '../utils/result-count';

export interface CategoryNavProps {
  categories: CatalogCategory[];
  /** The category page's slug; `null` on Shop All, which marks "All" current. */
  activeSlug: string | null;
  locale: AppLocale;
  /** `catalog.categoryNav.label` / `.all`, resolved by the page. */
  label: string;
  allLabel: string;
}

/**
 * The categories, Shop All and category pages only ("Atelier", owner decision
 * 2026-09-26). One list, two shapes (`.category-link` in app/globals.css):
 *
 * - **Below 1024**, a row of pill chips under the intro that scrolls sideways, bleeding
 *   to the viewport edge, with an inline-end fade (`[data-category-row]`).
 * - **From 1024**, the top of the index column beside the grid: a labelled list, one
 *   44px row per category with its piece count at the inline end, the current one
 *   marked by a Bronze rule at the inline start and weight — never colour alone.
 *
 * The count is the catalogue's own `productCount` (active pieces in that category);
 * "All" carries none, because the categories' counts need not add up to the shop's
 * total. Each count is visible as a numeral and read as "4 pieces".
 *
 * Categories are listed in the shop's order (`orderCategories`), not the API's.
 * Categories with no active products are left out unless they are the current
 * page: a link that always lands on an empty state is a dead end in navigation,
 * while the page itself still resolves (R2).
 */
export async function CategoryNav({
  categories,
  activeSlug,
  locale,
  label,
  allLabel,
}: CategoryNavProps) {
  const t = await getTranslations('catalog');
  const visible = orderCategories(categories).filter(
    (c) => c.productCount > 0 || c.slug === activeSlug
  );

  return (
    <nav aria-label={label}>
      <p
        aria-hidden="true"
        className="type-label hidden border-b border-border pb-3 text-text-secondary lg:block"
      >
        {label}
      </p>
      <ul
        role="list"
        data-category-row
        className="-mx-(--page-gutter) flex snap-x gap-2 overflow-x-auto px-(--page-gutter) pe-14 scroll-ps-(--page-gutter) lg:mx-0 lg:mt-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0"
      >
        <li className="shrink-0 snap-start">
          <Link
            href="/shop"
            aria-current={activeSlug === null ? 'page' : undefined}
            className="category-link"
          >
            {allLabel}
          </Link>
        </li>
        {visible.map((category) => {
          const name = localizedName(category, locale);
          return (
            <li key={category.slug} className="shrink-0 snap-start">
              <Link
                href={catalogPath({ kind: 'category', slug: category.slug })}
                aria-current={category.slug === activeSlug ? 'page' : undefined}
                className="category-link"
              >
                {name.lang === locale ? (
                  name.text
                ) : (
                  <span lang={name.lang} dir="auto">
                    {name.text}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="type-supporting hidden text-text-secondary tabular-nums lg:inline"
                >
                  {category.productCount}
                </span>
                <span className="sr-only">{`, ${formatResultCount(t, category.productCount)}`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
