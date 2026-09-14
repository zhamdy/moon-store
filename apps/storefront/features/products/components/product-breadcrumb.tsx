import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { langProps, localizedName } from '../utils/localized-name';

export interface ProductBreadcrumbProps {
  locale: AppLocale;
  product: Pick<CatalogProductDetail, 'name' | 'nameEn' | 'category'>;
  /** Built by the page, so this slice never imports `features/catalog`. */
  hrefs: { home: string; shop: string; category: string | null };
}

const CRUMB_LINK =
  '-my-3 inline-block py-3 underline-offset-4 transition-colors duration-fast ease-ui hover:text-text hover:underline';

/**
 * Home / Shop / Category / product. The product is the last, non-link item carrying
 * `aria-current="page"`, and the only one that truncates: the h1 below always shows the
 * full name. Separators are hidden from assistive technology; the row mirrors in RTL.
 */
export async function ProductBreadcrumb({ locale, product, hrefs }: ProductBreadcrumbProps) {
  const [t, tn] = await Promise.all([
    getTranslations({ locale, namespace: 'product.breadcrumb' }),
    getTranslations({ locale, namespace: 'navigation' }),
  ]);
  const name = localizedName(product, locale);
  const category =
    product.category && hrefs.category ? localizedName(product.category, locale) : null;

  const trail = [
    { key: 'home', href: hrefs.home, text: t('home'), attrs: {} },
    { key: 'shop', href: hrefs.shop, text: tn('shop'), attrs: {} },
    ...(category && hrefs.category
      ? [
          {
            key: 'category',
            href: hrefs.category,
            text: category.text,
            attrs: langProps(category, locale),
          },
        ]
      : []),
  ];

  return (
    <nav aria-label={t('label')} className="type-caption text-text-secondary">
      <ol className="flex min-w-0 items-center gap-x-2">
        {trail.map((crumb) => (
          <li key={crumb.key} className="flex shrink-0 items-center gap-x-2">
            <Link href={crumb.href} {...crumb.attrs} className={CRUMB_LINK}>
              {crumb.text}
            </Link>
            <span aria-hidden="true">/</span>
          </li>
        ))}
        <li className="min-w-0">
          <span
            aria-current="page"
            {...langProps(name, locale)}
            className="block truncate text-text"
          >
            {name.text}
          </span>
        </li>
      </ol>
    </nav>
  );
}
