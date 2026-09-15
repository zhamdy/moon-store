import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { CatalogPage } from '@/features/catalog/components/catalog-page';
import { loadCatalogParams, type CatalogRoute } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { listCatalogCategories } from '@/features/collections/api/list-catalog-categories';
import { localizedDescription, localizedName } from '@/features/products/utils/localized-name';

type Props = PageProps<'/[locale]/shop/[category]'>;

/**
 * The category from the cached list (KD-1); the page and `generateMetadata` share the
 * one memoized fetch. Unknown slug: `notFound()` before anything renders (KD-10). A
 * known category with no active products is found and shows the restocking state (R2).
 */
async function resolve(props: Props) {
  const { locale, category: slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const categories = await listCatalogCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return { locale: locale as AppLocale, categories, category };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, category } = await resolve(props);
  const route: CatalogRoute = { kind: 'category', slug: category.slug };
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const name = localizedName(category, locale);
  const description = localizedDescription(category, locale);

  return buildCatalogMetadata({
    locale,
    path: catalogPath(route),
    title: name.text,
    description:
      description && description.lang === locale
        ? description.text
        : t('meta.categoryDescription', { name: name.text }),
    params: await loadCatalogParams(props.searchParams, route),
  });
}

/** R2: one category's products. */
export default async function CategoryPage(props: Props) {
  const { locale, categories, category } = await resolve(props);
  setRequestLocale(locale);

  const route: CatalogRoute = { kind: 'category', slug: category.slug };
  const catalogParams = await loadCatalogParams(props.searchParams, route);

  return (
    <CatalogPage
      route={route}
      params={catalogParams}
      locale={locale}
      intro={{
        name: localizedName(category, locale),
        description: localizedDescription(category, locale),
      }}
      categories={categories}
    />
  );
}
