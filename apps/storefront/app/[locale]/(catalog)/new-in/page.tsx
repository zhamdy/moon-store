import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { CatalogPage } from '@/features/catalog/components/catalog-page';
import { loadCatalogParams, type CatalogRoute } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { catalogPath } from '@/features/catalog/utils/catalog-path';

const ROUTE: CatalogRoute = { kind: 'new' };

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/new-in'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });

  return buildCatalogMetadata({
    locale,
    path: catalogPath(ROUTE),
    title: t('intro.newInTitle'),
    description: t('meta.newInDescription'),
    params: await loadCatalogParams(searchParams, ROUTE),
  });
}

/** R3: derived from `created_at` through the listing's `new=true` scope. */
export default async function NewInPage({ params, searchParams }: PageProps<'/[locale]/new-in'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const catalogParams = await loadCatalogParams(searchParams, ROUTE);
  const t = await getTranslations('catalog');

  return (
    <CatalogPage
      route={ROUTE}
      params={catalogParams}
      locale={locale}
      intro={{ lead: { text: t('intro.newInTitle'), lang: locale } }}
    />
  );
}
