import type { Metadata } from 'next';
import Image from 'next/image';
import { editorialImages } from '@/lib/editorial/images';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { HEADER_BOUNDARY_ATTR } from '@/components/layout/header/header-boundary';
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
      {/*
        The page opens on the photograph itself, full-bleed to all four edges and
        pulled under the header by `--header-h` (the boundary attribute makes the
        header transparent at the top of the scroll, as the homepage hero does).
        Centred title and description over it, and nothing else: the eyebrow, the
        split two-column panel and the jump link were removed (owner decision,
        2026-09-21) — the directory begins one screen down, so a link to it was
        naming the scroll the visitor was already making.
      */}
      <header
        {...{ [HEADER_BOUNDARY_ATTR]: '' }}
        data-surface="dark"
        className="relative -mt-(--header-h) flex min-h-[clamp(28rem,72svh,44rem)] items-center overflow-hidden bg-dark-surface"
      >
        <div className="absolute inset-0">
          <Image
            src={editorialImages['lookbook-01'].src}
            alt=""
            fill
            preload
            sizes="100vw"
            className="object-cover object-top"
          />
          {/* Header band: enough to carry the ivory logo and nav over the crop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-scrim/70 to-transparent"
          />
          {/* One even wash so the centred copy clears contrast wherever it lands */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-dark-surface/55"
          />
        </div>
        <Container
          as="div"
          className="relative flex w-full flex-col items-center pt-(--header-h) text-center"
        >
          <h1 className="font-display text-[clamp(3rem,6.5vw,7rem)] leading-[1.1] tracking-tight text-text">
            {t('intro.collectionsTitle')}
          </h1>
          <p className="mt-6 max-w-[46ch] text-pretty type-body-lg text-text-secondary">
            {t('collections.description')}
          </p>
        </Container>
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
