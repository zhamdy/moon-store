import type { Metadata } from 'next';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { loadCollectionPieces } from '@/features/catalog/api/load-collection-pieces';
import { CatalogEmpty } from '@/features/catalog/components/catalog-empty';
import { CollectionChapter } from '@/features/catalog/components/collection-chapter';
import { DEFAULT_CATALOG_PARAMS } from '@/features/catalog/search-params';
import { buildCatalogMetadata } from '@/features/catalog/utils/catalog-metadata';
import { collectionChapters } from '@/features/catalog/utils/collection-chapters';
import { listCatalogCollections } from '@/features/collections/api/list-catalog-collections';

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

/**
 * R4, as "Chapters" (owner decision 2026-09-26, chosen from three directions drawn in
 * Claude Design; it replaces the full-bleed photograph and the card grid of 2026-09-21).
 * A short typographic intro under the solid header, then one chapter per live collection
 * in the server's order: its photograph, season, description, its first pieces with their
 * prices, and how many there are (`CollectionChapter`). The collections list failing is
 * the catalog error screen, as before; one collection's pieces failing only empties that
 * chapter's credits (`loadCollectionPieces`).
 */
export default async function CollectionsPage({ params }: PageProps<'/[locale]/collections'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Reads no searchParams, so without this it would prerender and call the API at build (KD-9).
  await connection();
  const collections = await listCatalogCollections();
  // One listing per collection, in parallel: each is the collection page's own page 1 and
  // shares its data-cache entry, so a chapter never lists what its page does not.
  const pieces = await Promise.all(collections.map((c) => loadCollectionPieces(c.slug)));
  const chapters = collectionChapters(collections, pieces);
  const t = await getTranslations('catalog');

  return (
    <>
      <Container as="header" className="pt-10 pb-10 md:pt-14 md:pb-12 lg:pt-16 lg:pb-14">
        <Reveal className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
          <div>
            <h1
              data-motion="rise"
              className="type-display [--motion-offset:120ms] [--motion-rise:24px]"
            >
              {t('intro.collectionsTitle')}
            </h1>
            <p
              data-motion="fade"
              className="type-body-lg mt-4 max-w-[34rem] text-pretty text-text-secondary [--motion-offset:240ms]"
            >
              {t('collections.description')}
            </p>
          </div>
          {chapters.length > 0 && (
            <p
              data-motion="fade"
              className="type-label pb-1.5 text-text-secondary tabular-nums [--motion-offset:300ms]"
            >
              {t('collections.count', { count: chapters.length })}
            </p>
          )}
        </Reveal>
      </Container>

      {chapters.length > 0 ? (
        <div>
          {chapters.map((chapter, index) => (
            <CollectionChapter
              key={chapter.collection.slug}
              chapter={chapter}
              locale={locale}
              priority={index === 0}
            />
          ))}
        </div>
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
