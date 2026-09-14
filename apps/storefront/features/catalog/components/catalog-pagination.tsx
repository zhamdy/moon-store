import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { CatalogPagination as CatalogPaginationMeta } from '@/features/products/types/catalog-product';
import { cn } from '@/lib/utils/cn';
import type { CatalogParams, CatalogRoute } from '../search-params';
import { catalogPageHref } from '../utils/catalog-path';
import { paginationWindow } from '../utils/pagination-window';

export interface CatalogPaginationProps {
  route: CatalogRoute;
  params: CatalogParams;
  pagination: Pick<CatalogPaginationMeta, 'totalPages'>;
}

const arrowLink = cn(
  'group inline-flex min-h-11 min-w-11 items-center justify-center gap-2 type-label text-text',
  'md:justify-start'
);
const arrowIcon = 'transition-transform duration-fast ease-ui rtl:-scale-x-100';

/**
 * Numbered, server-rendered pagination (R14). Real links, each ending in
 * `#catalog-results`, so a page change lands on the first row and moves the
 * sequential focus start to the results heading. Filters and sort are kept.
 *
 * Previous/next are omitted at the ends, not disabled. Below 768 the numbers
 * collapse to "Page 3 of 12" between two arrow links (their names stay in a
 * visually hidden label); from 768 the number window from `paginationWindow`
 * (at most 7 slots) replaces it. The current page is a link with
 * `aria-current="page"` and a brand hairline; gaps are hidden from assistive tech.
 * Arrows mirror under RTL with `rtl:-scale-x-100` (`scale`, so the hover nudge on
 * `translate` composes with it).
 */
export async function CatalogPagination({ route, params, pagination }: CatalogPaginationProps) {
  const { totalPages } = pagination;
  if (totalPages <= 1) return null;

  const t = await getTranslations('catalog.pagination');
  const page = Math.min(Math.max(params.page, 1), totalPages);

  return (
    <nav aria-label={t('label')} className="mt-16 md:mt-20 lg:mt-24">
      <div className="flex items-center justify-between gap-4 md:justify-center md:gap-10">
        {page > 1 ? (
          <Link href={catalogPageHref(route, params, page - 1)} rel="prev" className={arrowLink}>
            <ArrowLeft
              aria-hidden="true"
              size={18}
              className={cn(arrowIcon, 'group-hover:-translate-x-1 rtl:group-hover:translate-x-1')}
            />
            <span className="sr-only md:not-sr-only">{t('previous')}</span>
          </Link>
        ) : (
          <span aria-hidden="true" className="size-11 md:hidden" />
        )}

        <p className="type-small text-text-secondary tabular-nums md:hidden">
          {t('pageOf', { page, total: totalPages })}
        </p>

        <ol role="list" className="hidden items-center gap-1 md:flex">
          {paginationWindow(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <li
                key={`gap-${index}`}
                aria-hidden="true"
                className="type-small inline-flex size-11 items-center justify-center text-text-secondary"
              >
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={catalogPageHref(route, params, item)}
                  aria-label={t('page', { page: item })}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'type-small relative inline-flex size-11 items-center justify-center tabular-nums',
                    'text-text-secondary transition-colors duration-fast ease-ui hover:text-text',
                    'after:absolute after:inset-x-3 after:bottom-2 after:h-px after:bg-brand after:content-[""]',
                    'after:scale-x-0 after:transition-transform after:duration-fast after:ease-ui',
                    'aria-[current=page]:text-text aria-[current=page]:after:scale-x-100'
                  )}
                >
                  {item}
                </Link>
              </li>
            )
          )}
        </ol>

        {page < totalPages ? (
          <Link href={catalogPageHref(route, params, page + 1)} rel="next" className={arrowLink}>
            <span className="sr-only md:not-sr-only">{t('next')}</span>
            <ArrowRight
              aria-hidden="true"
              size={18}
              className={cn(arrowIcon, 'group-hover:translate-x-1 rtl:group-hover:-translate-x-1')}
            />
          </Link>
        ) : (
          <span aria-hidden="true" className="size-11 md:hidden" />
        )}
      </div>
    </nav>
  );
}
