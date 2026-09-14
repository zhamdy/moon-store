import { NavLink } from '@/components/layout/nav-link';
import { Container } from '@/components/ui/container';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogCategory } from '@/features/collections/types/catalog-category';
import { localizedName } from '@/features/products/utils/localized-name';
import { catalogPath } from '../utils/catalog-path';

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
 * Row 1 under the intro (KD-15), Shop All and category pages only: text links in
 * `type-label`, `aria-current="page"` on the active one. It scrolls horizontally
 * at every width with proximity scroll-snap and an inline-end fade
 * (`[data-category-row]` in app/globals.css). Bleeds to the viewport edge below
 * 768 like the homepage category rail. No hairline of its own: the utility row
 * below draws the one rule between the two rows.
 *
 * Categories with no active products are left out unless they are the current
 * page: a link that always lands on an empty state is a dead end in navigation,
 * while the page itself still resolves (R2).
 *
 * Each link's hit area is extended to 44px tall with a `before:` box, because
 * padding would move `NavLink`'s underline away from the text.
 */
export function CategoryNav({ categories, activeSlug, locale, label, allLabel }: CategoryNavProps) {
  const visible = categories.filter((c) => c.productCount > 0 || c.slug === activeSlug);
  const hitArea =
    "whitespace-nowrap before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']";

  return (
    <Container as="nav" aria-label={label}>
      <ul
        role="list"
        data-category-row
        className="-mx-(--page-gutter) flex snap-x gap-x-7 overflow-x-auto py-3 ps-(--page-gutter) pe-16 scroll-ps-(--page-gutter) md:mx-0 md:gap-x-9 md:ps-0 md:scroll-ps-0"
      >
        <li className="shrink-0 snap-start">
          <NavLink href="/shop" current={activeSlug === null} className={hitArea}>
            {allLabel}
          </NavLink>
        </li>
        {visible.map((category) => {
          const name = localizedName(category, locale);
          return (
            <li key={category.slug} className="shrink-0 snap-start">
              <NavLink
                href={catalogPath({ kind: 'category', slug: category.slug })}
                current={category.slug === activeSlug}
                className={hitArea}
              >
                {name.lang === locale ? (
                  name.text
                ) : (
                  <span lang={name.lang} dir="auto">
                    {name.text}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
