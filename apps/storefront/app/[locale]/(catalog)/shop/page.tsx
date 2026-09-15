import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { CatalogPage } from '@/features/catalog/components/catalog-page';
import { loadCatalogParams, type CatalogRoute } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { listCatalogCategories } from '@/features/collections/api/list-catalog-categories';

const ROUTE: CatalogRoute = { kind: 'all' };

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/shop'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });

  return buildCatalogMetadata({
    locale,
    path: catalogPath(ROUTE),
    title: t('intro.shop'),
    description: t('meta.shopDescription'),
    params: await loadCatalogParams(searchParams, ROUTE),
  });
}

/** R1: every active product, newest first. */
export default async function ShopPage({ params, searchParams }: PageProps<'/[locale]/shop'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const catalogParams = await loadCatalogParams(searchParams, ROUTE);
  // For the category row; resolved before anything streams, like every catalog entity.
  const categories = await listCatalogCategories();

  return (
    <CatalogPage
      route={ROUTE}
      params={catalogParams}
      locale={locale}
      intro={{}}
      categories={categories}
    />
  );
}
