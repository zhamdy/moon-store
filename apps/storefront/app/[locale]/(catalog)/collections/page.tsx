import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { editorialImages } from '@/lib/editorial/images';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { CatalogEmpty } from '@/features/catalog/components/catalog-empty';
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
      <header className="grid bg-surface-soft md:min-h-[560px] md:grid-cols-2">
        <div className="flex flex-col justify-between gap-10 px-(--page-gutter) py-12 md:py-16 lg:py-20">
          <p className="type-label text-brand">Moon Fashion</p>
          <div>
            <h1 className="font-display text-[clamp(3rem,6.5vw,7rem)] leading-[1.1] tracking-tight">
              {t('intro.collectionsTitle')}
            </h1>
            <p className="mt-6 max-w-sm text-pretty type-body-lg text-text-secondary">
              {t('collections.description')}
            </p>
          </div>
          <a
            href="#collection-directory"
            className="inline-flex min-h-11 w-fit items-center gap-5 border-b border-brand pb-2 type-label text-brand transition-colors hover:text-text"
          >
            {t('collections.browse')}
            <ArrowDown size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="relative aspect-4/3 overflow-hidden md:aspect-auto">
          <Image
            src={editorialImages['lookbook-01'].src}
            alt=""
            fill
            preload
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-top"
          />
        </div>
      </header>
      <Container
        as="section"
        id="collection-directory"
        aria-labelledby="collection-directory-heading"
        className="scroll-mt-28 pt-12 pb-6 md:pt-20 md:pb-8"
      >
        <h2 id="collection-directory-heading" className="type-label text-brand">
          {t('collections.directory')}
        </h2>
      </Container>
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
