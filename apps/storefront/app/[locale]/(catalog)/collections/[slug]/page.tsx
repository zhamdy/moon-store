import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { CatalogPage } from '@/features/catalog/components/catalog-page';
import { loadCatalogParams, type CatalogRoute } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { getCatalogCollection } from '@/features/collections/api/get-catalog-collection';
import { collectionMeta } from '@/features/collections/utils/collection-index-layout';
import { localizedDescription, localizedName } from '@/features/products/utils/localized-name';

type Props = PageProps<'/[locale]/collections/[slug]'>;

/**
 * The live collection, or `notFound()` for an unknown, upcoming or archived slug (the
 * API does not tell them apart), before anything renders (KD-10). One memoized fetch
 * serves both the page and `generateMetadata`.
 */
async function resolve(props: Props) {
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const collection = await getCatalogCollection(slug);
  if (!collection) notFound();
  return { locale: locale as AppLocale, collection };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, collection } = await resolve(props);
  const route: CatalogRoute = { kind: 'collection', slug: collection.slug };
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const name = localizedName(collection, locale);
  const description = localizedDescription(collection, locale);

  return buildCatalogMetadata({
    locale,
    path: catalogPath(route),
    title: name.text,
    description:
      description && description.lang === locale
        ? description.text
        : t('meta.collectionDescription', { name: name.text }),
    params: await loadCatalogParams(props.searchParams, route),
  });
}

/** R4: one live collection in its merchandised order. */
export default async function CollectionPage(props: Props) {
  const { locale, collection } = await resolve(props);
  setRequestLocale(locale);

  const route: CatalogRoute = { kind: 'collection', slug: collection.slug };
  const catalogParams = await loadCatalogParams(props.searchParams, route);

  return (
    <CatalogPage
      route={route}
      params={catalogParams}
      locale={locale}
      intro={{
        lead: localizedName(collection, locale),
        meta: collectionMeta(collection),
        description: localizedDescription(collection, locale),
        image: collection.imageUrl ? { url: collection.imageUrl } : null,
      }}
    />
  );
}
