import type { Metadata } from 'next';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { CatalogEmpty } from '@/features/catalog/components/catalog-empty';
import { PageIntro } from '@/features/catalog/components/page-intro';
import { DEFAULT_CATALOG_PARAMS } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { listCatalogCollections } from '@/features/collections/api/list-catalog-collections';
import { CollectionIndex } from '@/features/collections/components/collection-index';
import { collectionMeta } from '@/features/collections/utils/collection-index-layout';
import { localizedName } from '@/features/products/utils/localized-name';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/collections'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });

  return buildCatalogMetadata({
    locale,
    path: '/collections',
    title: t('intro.collectionsTitle'),
    description: t('meta.collectionsDescription'),
    params: DEFAULT_CATALOG_PARAMS,
  });
}

/** R4: the live collections, composed by count; no product grid, so nothing streams. */
export default async function CollectionsPage({ params }: PageProps<'/[locale]/collections'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Reads no searchParams, so without this it would prerender and call the API at build (KD-9).
  await connection();
  const collections = await listCatalogCollections();
  const t = await getTranslations('catalog');

  return (
    <>
      <PageIntro
        locale={locale}
        heading={{ label: t('intro.collections') }}
        lead={{ text: t('intro.collectionsTitle'), lang: locale }}
      />
      {collections.length > 0 ? (
        <CollectionIndex
          locale={locale}
          exploreLabel={t('collections.explore')}
          collections={collections.map((collection) => ({
            slug: collection.slug,
            href: catalogPath({ kind: 'collection', slug: collection.slug }),
            name: localizedName(collection, locale),
            meta: collectionMeta(collection),
            imageUrl: collection.imageUrl,
            isFeatured: collection.isFeatured,
          }))}
        />
      ) : (
        <Container as="section" className="pb-(--section-space)">
          <CatalogEmpty
            variant="catalog"
            route={{ kind: 'all' }}
            params={DEFAULT_CATALOG_PARAMS}
            headingLevel="h2"
          />
        </Container>
      )}
    </>
  );
}
